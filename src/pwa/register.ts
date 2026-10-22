import type { WorkerRequest, WorkerStatus } from './precache';

// F:PWA-01, T:PWA-T01–T03: rejestracja service workera i stan widoczny dla interfejsu.
// Gotowość offline ogłaszamy dopiero, gdy aktywny worker potwierdzi komplet zasobów w cache.
// Nowa wersja czeka (`waiting`) — przejmuje grę wyłącznie przez `applyUpdate` (SH-041).

export type PwaStatus = {
  supported: boolean;
  offlineReady: boolean;
  updateWaiting: boolean;
};

export type Pwa = {
  getStatus(): PwaStatus;
  subscribe(listener: () => void): () => void;
  // Aktywuje oczekującą wersję i przeładowuje stronę po przejęciu kontroli przez nowego workera.
  applyUpdate(): boolean;
};

const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function createPwa(container: ServiceWorkerContainer | undefined, scriptUrl: string): Pwa {
  let status: PwaStatus = { supported: !!container, offlineReady: false, updateWaiting: false };
  let registration: ServiceWorkerRegistration | null = null;
  const listeners = new Set<() => void>();
  const set = (patch: Partial<PwaStatus>) => {
    const next = { ...status, ...patch };
    if (
      next.offlineReady === status.offlineReady &&
      next.updateWaiting === status.updateWaiting &&
      next.supported === status.supported
    ) {
      return;
    }
    status = next;
    for (const listener of listeners) listener();
  };
  const send = (worker: ServiceWorker | null | undefined, message: WorkerRequest) =>
    worker?.postMessage(message);

  if (container) {
    container.addEventListener('message', (event: MessageEvent<WorkerStatus>) => {
      if (event.data.type === 'status') set({ offlineReady: event.data.ready });
    });

    const watchInstalling = (worker: ServiceWorker | null) => {
      worker?.addEventListener('statechange', () => {
        // Nowa wersja zainstalowana (komplet w jej cache), a grą steruje jeszcze stara.
        if (worker.state === 'installed' && container.controller) set({ updateWaiting: true });
        // Pierwsza instalacja: po aktywacji pytamy o kompletność cache.
        if (worker.state === 'activated') send(worker, { type: 'status' });
      });
    };

    void container
      .register(scriptUrl)
      .then((reg) => {
        registration = reg;
        if (reg.waiting && container.controller) set({ updateWaiting: true });
        watchInstalling(reg.installing);
        reg.addEventListener('updatefound', () => watchInstalling(reg.installing));
        send(reg.active, { type: 'status' });
        setInterval(() => void reg.update().catch(() => undefined), UPDATE_CHECK_MS);
      })
      .catch(() => set({ supported: false }));
  }

  return {
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    applyUpdate() {
      const waiting = registration?.waiting;
      if (!container || !waiting) return false;
      container.addEventListener('controllerchange', () => window.location.reload(), {
        once: true,
      });
      send(waiting, { type: 'skipWaiting' });
      return true;
    },
  };
}

// Jedna instancja na stronę; w trybie deweloperskim service worker jest wyłączony
// (Vite serwuje moduły na żądanie — cache przeszkadzałby w pracy).
let instance: Pwa | null = null;

export function pwa(): Pwa {
  if (!instance) {
    const container =
      import.meta.env.PROD && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
    instance = createPwa(container, `${import.meta.env.BASE_URL}sw.js`);
  }
  return instance;
}
