import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  createSaveManager,
  loadGame,
  type Backup,
  type LoadError,
  type LoadErrorCode,
  type SaveManager,
} from '../application/saveManager';
import {
  createBrowserTabEnvironment,
  createTabCoordinator,
  type TabCoordinator,
} from '../application/tabCoordinator';
import { DEFAULT_BALANCE } from '../domain/config';
import { createInitialState, type GameState } from '../domain/state';
import { loadChapterStart, prepareChapterTwo } from '../application/chapterFlow';
import { chapterTwoDevState } from '../application/devStart';
import { CHAPTER_TWO_ENABLED } from '../application/features';
import { createFlightGuard, watchConflict } from '../application/sessionGuards';
import { createIndexedDbSaveStore, revisionOf, type SaveStore } from '../persistence/saveStore';
import type { ValidationContext } from '../persistence/schema';
import { serializeSnapshot } from '../persistence/snapshot';
import { createEngine, type Engine } from '../simulation/engine';
import { createPrologueState } from '../simulation/prologue';
import { pwa } from '../pwa/register';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import { App } from './App';
import type { MissionKind } from './navigation';
import type { InterludeId } from '../domain/content/interludes';
import { ConfirmDialog } from './ConfirmDialog';

const CONTEXT: ValidationContext = { config: DEFAULT_BALANCE, layout: OFFICE_LAYOUT };

// `intro` — przerywnik pokazywany na starcie sesji (początek prologu), poza stanem gry.
type Session = { id: number; engine: Engine; manager: SaveManager; intro: InterludeId | null };

type View =
  | { kind: 'starting' }
  | { kind: 'otherTab' }
  | { kind: 'loadError'; error: LoadError; revision: number | null; backup: Backup | null }
  | { kind: 'playing'; session: Session }
  | { kind: 'yielded' };

type PageTabs = {
  coordinator: TabCoordinator;
  role: Promise<'writer' | 'otherTabActive'>;
  handlers: { onYield(): Promise<void>; onLost(): void };
};

let pageTabsInstance: PageTabs | null = null;

// Jeden koordynator na kartę, na cały czas życia strony: blokadę zwalnia przeglądarka przy
// zamknięciu karty. Komponent tylko podpina obsługę — podwójny montaż w StrictMode nie
// tworzy drugiej prośby o blokadę, która trafiłaby na blokadę tej samej karty.
function pageTabs(): PageTabs {
  if (!pageTabsInstance) {
    const handlers: PageTabs['handlers'] = {
      onYield: () => Promise.resolve(),
      onLost: () => undefined,
    };
    const coordinator = createTabCoordinator(createBrowserTabEnvironment(), {
      onYield: () => handlers.onYield(),
      onLost: () => handlers.onLost(),
    });
    pageTabsInstance = { coordinator, handlers, role: coordinator.start() };
  }
  return pageTabsInstance;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

// Pierwsze uruchomienie zaczyna się od prologu (samouczka); właściwa misja — po nim albo
// na wyraźny wybór gracza.
function newState(kind: MissionKind): GameState {
  if (kind === 'chapterTwoDev') return chapterTwoDevState(DEFAULT_BALANCE, randomSeed());
  return kind === 'prologue'
    ? createPrologueState(DEFAULT_BALANCE, randomSeed())
    : createInitialState(DEFAULT_BALANCE, randomSeed());
}

// SH-048: przerywnik „Na swoim” na początku prologu (za flagą rozdziału 2, razem z pozostałymi).
function prologueIntro(kind: MissionKind): InterludeId | null {
  return CHAPTER_TWO_ENABLED && kind === 'prologue' ? 'beforePrologue' : null;
}

function createSession(
  store: SaveStore,
  state: GameState,
  saved: { revision: number | null; state: GameState | null; keepPrevious?: boolean },
  intro: InterludeId | null = null,
): Session {
  const engine = createEngine({ config: DEFAULT_BALANCE, initialState: state });
  const manager = createSaveManager({
    engine,
    store,
    context: CONTEXT,
    buildVersion: __APP_VERSION__,
    storedRevision: saved.revision,
    savedState: saved.state,
    keepPreviousOnFirstWrite: saved.keepPrevious ?? false,
    now: () => new Date().toISOString(),
  });
  return { id: Date.now(), engine, manager, intro };
}

// Start gry: rola karty (SH-004 A5) → wczytanie zapisu (SAVE-03) → gra lub ekran wyjaśnienia.
export function GameRoot() {
  const [store] = useState(() => createIndexedDbSaveStore());
  const [view, setView] = useState<View>({ kind: 'starting' });
  const coordinatorRef = useRef<TabCoordinator | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const play = useCallback((session: Session) => {
    sessionRef.current = session;
    setView({ kind: 'playing', session });
  }, []);

  const startSession = useCallback(async () => {
    const result = await loadGame(store, CONTEXT);
    if (result.kind === 'error') {
      setView({
        kind: 'loadError',
        error: result.error,
        revision: result.revision,
        backup: result.backup,
      });
      return;
    }
    if (result.kind === 'loaded') {
      play(
        createSession(store, result.state, { revision: result.revision, state: result.savedState }),
      );
      return;
    }
    const session = createSession(
      store,
      newState('prologue'),
      { revision: null, state: null },
      prologueIntro('prologue'),
    );
    play(session);
    void session.manager.save();
  }, [store, play]);

  // SAVE-04: nowa misja zastępuje zapis — wywoływana dopiero po potwierdzeniu gracza.
  // `keepPrevious` — bieżący zapis jest uszkodzony: nie przesuwamy go nad poprawną kopię (SH-039).
  const startNewMission = useCallback(
    async (keepPrevious = false, kind: MissionKind = 'mission') => {
      // Niedostępna pamięć: gra startuje, a błąd zapisu pokaże wskaźnik zapisu (SAVE-T03).
      const current = await store.read().then(
        (saves) => saves.current,
        () => null,
      );
      const state = newState(kind);
      // Wersja deweloperska: start w rozdziale 2 zapisuje też kopię startu rozdziału („Ponów”).
      if (kind === 'chapterTwoDev') {
        const copy = serializeSnapshot(
          state,
          { gameBuildVersion: __APP_VERSION__, revision: 0, savedAt: new Date().toISOString() },
          CONTEXT,
        );
        if (copy.ok) await store.writeChapterStart(copy.json);
      }
      const session = createSession(
        store,
        state,
        { revision: revisionOf(current), state: null, keepPrevious },
        prologueIntro(kind),
      );
      play(session);
      await session.manager.save();
    },
    [store, play],
  );

  // Rozdział 2 (SH-049): nowy stan i kopia startu rozdziału. Bieżący zapis rozdziału 2 powstaje
  // przed pokazaniem gry — zamknięcie zaraz po przejściu nie wraca do wygranego rozdziału 1.
  const continueToChapterTwo = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    const prepared = prepareChapterTwo(
      current.engine.getState(),
      CONTEXT,
      __APP_VERSION__,
      new Date().toISOString(),
    );
    if (!prepared.ok) return;
    await store.writeChapterStart(prepared.chapterStartJson);
    const saves = await store.read().catch(() => ({ current: null }));
    const session = createSession(store, prepared.state, {
      revision: revisionOf(saves.current),
      state: null,
    });
    await session.manager.save();
    play(session);
  }, [store, play]);

  // Ponowienie rozdziału 2 po bankructwie: stan z kopii startu rozdziału zastępuje zapis.
  const retryChapter = useCallback(async () => {
    const start = await loadChapterStart(store, CONTEXT);
    if (!start) return;
    const saves = await store.read().catch(() => ({ current: null }));
    const session = createSession(store, start, {
      revision: revisionOf(saves.current),
      state: null,
    });
    await session.manager.save();
    play(session);
  }, [store, play]);

  // Drugie dotknięcie w trakcie przejścia lub ponowienia nic nie robi (dwie sesje = konflikt zapisu).
  const [chapterGuard] = useState(createFlightGuard);

  // Kopia startu rozdziału 2 — sprawdzana raz na sesję rozdziału 2 (przycisk „Ponów”).
  const [canRetryChapter, setCanRetryChapter] = useState(false);
  const playingChapter =
    view.kind === 'playing' ? view.session.engine.getState().mission.chapter : null;
  useEffect(() => {
    if (!CHAPTER_TWO_ENABLED || playingChapter !== 2) return;
    let active = true;
    void loadChapterStart(store, CONTEXT).then((start) => {
      if (active) setCanRetryChapter(start !== null);
    });
    return () => {
      active = false;
    };
  }, [store, playingChapter, view]);

  // Decyzja SH-004 A6a: gra z poprawnej kopii awaryjnej — tylko na wyraźny wybór gracza.
  // Uszkodzony bieżący zapis zostanie zastąpiony, a kopia zachowana do pierwszego zapisu.
  const loadBackup = useCallback(
    (backup: Backup, revision: number | null) => {
      const session = createSession(store, backup.state, {
        revision,
        state: null,
        keepPrevious: true,
      });
      play(session);
      // Od razu zastępujemy uszkodzony bieżący zapis wczytaną kopią (kopia zostaje w `previous`).
      void session.manager.save();
    },
    [store, play],
  );

  useEffect(() => {
    let active = true;
    const tabs = pageTabs();
    tabs.handlers.onYield = async () => {
      // Przed oddaniem gry innej karcie: pauza, zapis, blokada widoku.
      const session = sessionRef.current;
      if (session) {
        if (session.engine.getState().mission.speed !== 0) {
          session.engine.dispatch({ type: 'SetSpeed', speed: 0 });
        }
        await session.manager.save();
      }
      sessionRef.current = null;
      if (active) setView({ kind: 'yielded' });
    };
    tabs.handlers.onLost = () => {
      sessionRef.current = null;
      if (active) setView({ kind: 'yielded' });
    };
    coordinatorRef.current = tabs.coordinator;
    void tabs.role.then((role) => {
      if (!active) return;
      if (role === 'writer') void startSession();
      else setView({ kind: 'otherTab' });
    });
    return () => {
      active = false;
      tabs.handlers.onYield = () => Promise.resolve();
      tabs.handlers.onLost = () => undefined;
    };
  }, [startSession]);

  // Konflikt rewizji: inna karta zapisała grę — ta przestaje grać i zapisywać.
  useEffect(() => {
    if (view.kind !== 'playing') return;
    // Także konflikt sprzed subskrypcji (sesja zapisana przed pokazaniem gry).
    return watchConflict(view.session.manager, () => {
      sessionRef.current = null;
      setView({ kind: 'yielded' });
    });
  }, [view]);

  const takeOver = async () => {
    setView({ kind: 'starting' });
    await coordinatorRef.current?.takeOver();
    await startSession();
  };

  switch (view.kind) {
    case 'starting':
      return <Screen title="Sprint Happens!" message="Wczytywanie…" />;
    case 'otherTab':
    case 'yielded':
      return (
        <Screen
          title="Gra jest otwarta w innej karcie"
          message="Postęp zapisuje tylko jedna karta naraz. Możesz przejąć grę — druga karta zapisze stan i się zatrzyma."
          action={{ label: 'Graj tutaj', onClick: () => void takeOver() }}
        />
      );
    case 'loadError':
      return (
        <LoadErrorScreen
          error={view.error}
          backup={view.backup}
          onLoadBackup={(backup) => loadBackup(backup, view.revision)}
          onNewMission={() => void startNewMission(view.error.code !== 'newerVersion')}
        />
      );
    case 'playing':
      return (
        <App
          key={view.session.id}
          engine={view.session.engine}
          intro={view.session.intro}
          saveManager={view.session.manager}
          onNewGame={(kind) => void startNewMission(false, kind)}
          chapterActions={{
            onContinue: () => void chapterGuard.run(continueToChapterTwo),
            onRetry: () => void chapterGuard.run(retryChapter),
            canRetry: canRetryChapter,
          }}
        />
      );
  }
}

const LOAD_ERROR_MESSAGES: Record<LoadErrorCode, string> = {
  storageUnavailable:
    'Przeglądarka nie pozwala zapisywać gry (np. tryb prywatny lub brak miejsca). Możesz zagrać, ale postęp nie zostanie zapisany.',
  invalidJson: 'Zapis gry jest uszkodzony.',
  invalidEnvelope: 'Zapis gry jest uszkodzony.',
  invalidState: 'Zapis gry jest uszkodzony lub niespójny.',
  newerVersion: 'Zapis pochodzi z nowszej wersji gry. Zaktualizuj grę, aby go wczytać.',
  needsMigration: 'Zapis pochodzi ze starszej wersji gry, której ta wersja nie potrafi przenieść.',
  migrationFailed:
    'Nie udało się przenieść zapisu ze starszej wersji gry. Oryginalny zapis pozostał nietknięty.',
};

const savedAtFormat = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' });

function backupLabel(backup: Backup): string {
  const date = new Date(backup.savedAt);
  const when = Number.isNaN(date.getTime()) ? backup.savedAt : savedAtFormat.format(date);
  return `Wczytaj kopię z ${when}, dzień misji ${backup.day}`;
}

// T:SAVE-T05, decyzja SH-004 A6: błąd odczytu nie usuwa misji i nie rozpoczyna nowej ani nie
// wczytuje kopii bez decyzji gracza. Zapis z nowszej wersji nie jest ani wczytywany, ani
// nadpisywany — nowa misja tylko po potwierdzeniu zastąpienia (A6b).
function LoadErrorScreen({
  error,
  backup,
  onLoadBackup,
  onNewMission,
}: {
  error: LoadError;
  backup: Backup | null;
  onLoadBackup(backup: Backup): void;
  onNewMission(): void;
}) {
  const [asking, setAsking] = useState(false);
  const message = backup
    ? `${LOAD_ERROR_MESSAGES[error.code]} Dostępna jest poprzednia poprawna kopia gry.`
    : LOAD_ERROR_MESSAGES[error.code];
  return (
    <>
      <main className="screen">
        <h1>Nie można wczytać gry</h1>
        <p>{message}</p>
        {error.code === 'newerVersion' && <UpdateNowButton />}
        {backup && (
          <button type="button" onClick={() => onLoadBackup(backup)}>
            {backupLabel(backup)}
          </button>
        )}
        <button type="button" className="secondary-button" onClick={() => setAsking(true)}>
          Rozpocznij nową misję
        </button>
      </main>
      {asking && (
        <ConfirmDialog
          title="Rozpocząć nową misję?"
          message={
            error.code === 'storageUnavailable'
              ? 'Gra wystartuje, ale bez zapisu postępu — po zamknięciu strony misja przepadnie.'
              : backup
                ? 'Uszkodzony zapis zostanie zastąpiony nową misją. Kopia z poprzedniej gry przepadnie przy kolejnych zapisach.'
                : 'Istniejący zapis zostanie zastąpiony i nie będzie można go odzyskać.'
          }
          confirmLabel="Nowa misja"
          onCancel={() => setAsking(false)}
          onConfirm={onNewMission}
        />
      )}
    </>
  );
}

// Decyzja SH-004 A6b: przy zapisie z nowszej wersji — aktualizacja, jeśli już pobrana.
// Bez zapisu: gra nie działa, a nowszego zapisu nie wolno nadpisać.
function UpdateNowButton() {
  const instance = pwa();
  const status = useSyncExternalStore(instance.subscribe, instance.getStatus);
  if (!status.updateWaiting) {
    return (
      <p className="hint">Nowa wersja pobierze się automatycznie przy dostępie do internetu.</p>
    );
  }
  return (
    <button type="button" onClick={() => instance.applyUpdate()}>
      Zaktualizuj grę
    </button>
  );
}

function Screen({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { label: string; onClick(): void };
}) {
  return (
    <main className="screen">
      <h1>{title}</h1>
      <p>{message}</p>
      {action && (
        <button type="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </main>
  );
}
