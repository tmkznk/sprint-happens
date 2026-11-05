import type { GameState } from '../domain/state';
import type { Command } from '../simulation/commands';
import type { Engine } from '../simulation/engine';

// Statystyki odwiedzin i kluczowych momentów gry (GoatCounter, bez cookies). Silnik o nich nie
// wie: zdarzenia wynikają z poleceń, które już zmieniły stan, więc odrzucone nie są liczone.
// Żadna awaria statystyk nie może dotknąć gry.

export type AnalyticsEvent = {
  path: string;
  title: string;
  // GoatCounter domyślnie łączy powtórzenia w sesji; `true` liczy każde wystąpienie.
  countEach?: boolean;
};

type Milestones = {
  prologueStep: NonNullable<GameState['prologue']>['step'] | null;
  status: GameState['mission']['status'];
};

function milestones(state: GameState): Milestones {
  return { prologueStep: state.prologue?.step ?? null, status: state.mission.status };
}

// Porównanie ze stanem sprzed polecenia: wczytanie zapisu z ukończoną misją nie liczy jej ponownie.
export function eventsFor(
  command: Command,
  before: Milestones,
  after: Milestones,
): AnalyticsEvent[] {
  if (after.prologueStep !== null) {
    // Zatrudnienie i wynik w samouczku nie mówią o decyzjach gracza — liczymy tylko jego koniec.
    return after.prologueStep === 'finished' && before.prologueStep !== 'finished'
      ? [{ path: 'prologue-finished', title: 'Ukończono prolog' }]
      : [];
  }
  const events: AnalyticsEvent[] = [];
  if (command.type === 'HireCandidate') {
    events.push({ path: 'hire-employee', title: 'Zatrudniono pracownika', countEach: true });
  }
  if (before.status !== after.status) {
    if (after.status === 'won') events.push({ path: 'mission-won', title: 'Wygrana misja' });
    if (after.status === 'bankrupt') {
      events.push({ path: 'mission-bankrupt', title: 'Bankructwo' });
    }
  }
  return events;
}

export function attachAnalytics(
  engine: Pick<Engine, 'getState' | 'subscribeCommands'>,
  send: (event: AnalyticsEvent) => void = analyticsSender.send,
): () => void {
  let before = milestones(engine.getState());
  return engine.subscribeCommands((command, state) => {
    const after = milestones(state);
    for (const event of eventsFor(command, before, after)) send(event);
    before = after;
  });
}

// Skrypt ładuje się asynchronicznie i bez kolejki po swojej stronie, więc zdarzenia sprzed jego
// gotowości czekają tutaj (bez odpytywania). Bez `start` wszystko jest pomijane (dev, testy).
const MAX_PENDING = 20;

export function createAnalyticsSender() {
  let pending: AnalyticsEvent[] | null = null;
  let deliver: ((event: AnalyticsEvent) => void) | null = null;

  const safeDeliver = (target: (event: AnalyticsEvent) => void, event: AnalyticsEvent) => {
    try {
      target(event);
    } catch {
      // Statystyki są opcjonalne; błąd nie może przerwać polecenia gracza.
    }
  };

  return {
    start() {
      pending = [];
    },
    ready(target: (event: AnalyticsEvent) => void) {
      for (const event of pending ?? []) safeDeliver(target, event);
      pending = null;
      deliver = target;
    },
    // Skrypt niedostępny (offline, bloker): dalsze zdarzenia przepadają.
    stop() {
      pending = null;
      deliver = null;
    },
    send(event: AnalyticsEvent) {
      if (deliver) safeDeliver(deliver, event);
      else if (pending && pending.length < MAX_PENDING) pending.push(event);
    },
  };
}

const analyticsSender = createAnalyticsSender();

type GoatCounterApi = {
  count?(vars: { path: string; title: string; event: true; no_session: boolean }): void;
};

export function startAnalytics(siteCode: string): void {
  analyticsSender.start();
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.dataset.goatcounter = `https://${siteCode}.goatcounter.com/count`;
  script.onload = () => {
    const api = (window as Window & { goatcounter?: GoatCounterApi }).goatcounter;
    analyticsSender.ready(({ path, title, countEach }) => {
      api?.count?.({ path, title, event: true, no_session: countEach ?? false });
    });
  };
  script.onerror = () => {
    analyticsSender.stop();
  };
  document.head.append(script);
}
