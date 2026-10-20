// T:SAVE-T07 (decyzja SH-004 A5): zapisuje tylko jedna karta. Druga może przejąć grę —
// wtedy pierwsza zapisuje stan, pauzuje i blokuje się, a dopiero potem oddaje prawo zapisu.

export type HeldLock = { release(): void };

export type TabMessage = { type: 'takeoverRequest' } | { type: 'released' };

export type TabEnvironment = {
  // Zwraca blokadę albo null, gdy jest zajęta (i nie wymuszamy przejęcia). `onLost` wywoływane,
  // gdy blokadę odbierze inna karta.
  acquire(options: { steal: boolean }, onLost: () => void): Promise<HeldLock | null>;
  post(message: TabMessage): void;
  subscribe(listener: (message: TabMessage) => void): () => void;
  close(): void;
};

// Jeśli pierwsza karta nie odpowie (np. uśpiona w tle), przejmujemy blokadę siłą. Konflikt
// rewizji w magazynie i tak nie pozwoli jej nadpisać nowszego zapisu.
export const TAKEOVER_TIMEOUT_MS = 3000;

export type TabCoordinator = {
  // 'writer' — ta karta zapisuje; 'otherTabActive' — gra jest otwarta w innej karcie.
  start(): Promise<'writer' | 'otherTabActive'>;
  takeOver(): Promise<void>;
  dispose(): void;
};

export function createTabCoordinator(
  environment: TabEnvironment,
  handlers: {
    // Przed oddaniem gry: zapis, pauza, blokada widoku.
    onYield(): Promise<void>;
    // Blokada odebrana bez uprzedzenia — ta karta nie może już zapisywać.
    onLost(): void;
  },
  timers: { wait(ms: number): Promise<void> } = {
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  },
): TabCoordinator {
  let lock: HeldLock | null = null;
  let disposed = false;
  let yielding = false;

  const keep = (held: HeldLock | null) => {
    if (held && disposed) {
      held.release();
      return null;
    }
    lock = held;
    return held;
  };
  const lost = () => {
    if (yielding || disposed) return;
    lock = null;
    handlers.onLost();
  };

  const stopListening = environment.subscribe((message) => {
    if (message.type !== 'takeoverRequest' || !lock || yielding) return;
    yielding = true;
    void handlers.onYield().finally(() => {
      lock?.release();
      lock = null;
      environment.post({ type: 'released' });
    });
  });

  return {
    async start() {
      return keep(await environment.acquire({ steal: false }, lost)) ? 'writer' : 'otherTabActive';
    },

    async takeOver() {
      const released = new Promise<void>((resolve) => {
        const stop = environment.subscribe((message) => {
          if (message.type === 'released') {
            stop();
            resolve();
          }
        });
      });
      environment.post({ type: 'takeoverRequest' });
      await Promise.race([released, timers.wait(TAKEOVER_TIMEOUT_MS)]);
      keep(await environment.acquire({ steal: true }, lost));
    },

    dispose() {
      disposed = true;
      stopListening();
      lock?.release();
      lock = null;
      environment.close();
    },
  };
}

const LOCK_NAME = 'sprint-happens-writer';
const CHANNEL_NAME = 'sprint-happens-tabs';

// Web Locks API + BroadcastChannel. Bez Web Locks (stare przeglądarki) karta zostaje
// zapisującą, a przed nadpisaniem chroni kontrola rewizji w magazynie.
export function createBrowserTabEnvironment(): TabEnvironment {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  return {
    acquire({ steal }, onLost) {
      if (!('locks' in navigator)) return Promise.resolve({ release: () => undefined });
      return new Promise((resolve) => {
        let release: () => void = () => undefined;
        const held = new Promise<void>((done) => {
          release = done;
        });
        navigator.locks
          .request(LOCK_NAME, steal ? { steal: true } : { ifAvailable: true }, async (granted) => {
            if (!granted) {
              resolve(null);
              return;
            }
            resolve({ release });
            await held;
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === 'AbortError') onLost();
          });
      });
    },
    post: (message) => channel.postMessage(message),
    subscribe(listener) {
      const onMessage = (event: MessageEvent<TabMessage>) => listener(event.data);
      channel.addEventListener('message', onMessage);
      return () => channel.removeEventListener('message', onMessage);
    },
    close: () => channel.close(),
  };
}
