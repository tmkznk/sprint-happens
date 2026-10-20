import { useCallback, useEffect, useRef, useState } from 'react';
import { createSaveManager, loadGame, type SaveManager } from '../application/saveManager';
import {
  createBrowserTabEnvironment,
  createTabCoordinator,
  type TabCoordinator,
} from '../application/tabCoordinator';
import { DEFAULT_BALANCE } from '../domain/config';
import { createInitialState, type GameState } from '../domain/state';
import { createIndexedDbSaveStore, revisionOf, type SaveStore } from '../persistence/saveStore';
import type { ValidationContext } from '../persistence/schema';
import type { SnapshotError } from '../persistence/snapshot';
import { createEngine, type Engine } from '../simulation/engine';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import { App } from './App';
import { ConfirmDialog } from './ConfirmDialog';

const CONTEXT: ValidationContext = { config: DEFAULT_BALANCE, layout: OFFICE_LAYOUT };

type Session = { id: number; engine: Engine; manager: SaveManager };

type View =
  | { kind: 'starting' }
  | { kind: 'otherTab' }
  | { kind: 'loadError'; error: SnapshotError }
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

function createSession(
  store: SaveStore,
  state: GameState,
  saved: { revision: number | null; state: GameState | null },
): Session {
  const engine = createEngine({ config: DEFAULT_BALANCE, initialState: state });
  const manager = createSaveManager({
    engine,
    store,
    context: CONTEXT,
    buildVersion: __APP_VERSION__,
    storedRevision: saved.revision,
    savedState: saved.state,
    now: () => new Date().toISOString(),
  });
  return { id: Date.now(), engine, manager };
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
      setView({ kind: 'loadError', error: result.error });
      return;
    }
    if (result.kind === 'loaded') {
      play(
        createSession(store, result.state, { revision: result.revision, state: result.savedState }),
      );
      return;
    }
    const session = createSession(store, createInitialState(DEFAULT_BALANCE, randomSeed()), {
      revision: null,
      state: null,
    });
    play(session);
    void session.manager.save();
  }, [store, play]);

  // SAVE-04: nowa misja zastępuje zapis — wywoływana dopiero po potwierdzeniu gracza.
  const startNewMission = useCallback(async () => {
    const { current } = await store.read();
    const session = createSession(store, createInitialState(DEFAULT_BALANCE, randomSeed()), {
      revision: revisionOf(current),
      state: null,
    });
    play(session);
    await session.manager.save();
  }, [store, play]);

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
    const { manager } = view.session;
    return manager.subscribe(() => {
      if (manager.getStatus().kind === 'conflict') {
        sessionRef.current = null;
        setView({ kind: 'yielded' });
      }
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
      return <LoadErrorScreen error={view.error} onNewMission={() => void startNewMission()} />;
    case 'playing':
      return (
        <App
          key={view.session.id}
          engine={view.session.engine}
          saveManager={view.session.manager}
          onNewGame={() => void startNewMission()}
        />
      );
  }
}

const LOAD_ERROR_MESSAGES: Record<SnapshotError['code'], string> = {
  invalidJson: 'Zapis gry jest uszkodzony.',
  invalidEnvelope: 'Zapis gry jest uszkodzony.',
  invalidState: 'Zapis gry jest uszkodzony lub niespójny.',
  newerVersion: 'Zapis pochodzi z nowszej wersji gry. Zaktualizuj grę, aby go wczytać.',
  needsMigration: 'Zapis pochodzi ze starszej wersji gry i wymaga aktualizacji formatu.',
};

// T:SAVE-T05 — błąd odczytu nie usuwa misji i nie rozpoczyna nowej bez zgody gracza.
// Odzyskiwanie z kopii awaryjnej i migracje — SH-039.
function LoadErrorScreen({ error, onNewMission }: { error: SnapshotError; onNewMission(): void }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Screen
        title="Nie można wczytać gry"
        message={LOAD_ERROR_MESSAGES[error.code]}
        action={{ label: 'Rozpocznij nową misję', onClick: () => setAsking(true) }}
      />
      {asking && (
        <ConfirmDialog
          title="Rozpocząć nową misję?"
          message="Istniejący zapis zostanie zastąpiony i nie będzie można go odzyskać."
          confirmLabel="Nowa misja"
          onCancel={() => setAsking(false)}
          onConfirm={onNewMission}
        />
      )}
    </>
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
