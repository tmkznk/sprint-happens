import type { GameState } from '../domain/state';
import { parseSnapshot, serializeSnapshot, type SnapshotError } from '../persistence/snapshot';
import type { ValidationContext } from '../persistence/schema';
import { revisionOf, type SaveStore } from '../persistence/saveStore';
import type { Command } from '../simulation/commands';
import type { Engine } from '../simulation/engine';

// SAVE-02, T:SAVE-T03 (B, decyzja SH-004 B6): okresowy autozapis w czasie rzeczywistym.
export const AUTOSAVE_INTERVAL_MS = 15_000;

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; revision: number }
  // T:SAVE-T03 — błąd zapisu jest widoczny; nigdy nie pokazujemy fałszywego sukcesu.
  | { kind: 'error'; message: string }
  // Inna karta zapisała grę — ta karta traci prawo zapisu (SH-004 A5).
  | { kind: 'conflict'; message: string };

export type SaveManager = {
  // Zapisuje bieżący stan, jeśli zmienił się od ostatniego udanego zapisu.
  save(): Promise<void>;
  getStatus(): SaveStatus;
  subscribe(listener: () => void): () => void;
};

export type SaveManagerOptions = {
  engine: Engine;
  store: SaveStore;
  context: ValidationContext;
  buildVersion: string;
  // Rewizja zapisu w magazynie w chwili startu (null — brak zapisu).
  storedRevision: number | null;
  // Stan odpowiadający zapisowi w magazynie — pozwala pominąć zbędny zapis.
  savedState: GameState | null;
  now(): string;
};

export function createSaveManager(options: SaveManagerOptions): SaveManager {
  const { engine, store, context } = options;
  let revision = options.storedRevision;
  let lastSaved = options.savedState;
  let status: SaveStatus = { kind: 'idle' };
  let running: Promise<void> | null = null;
  let again = false;
  const listeners = new Set<() => void>();

  // Odczyt przez funkcję: status zmienia się asynchronicznie, poza zawężaniem typów TS.
  const lostWriterRole = () => status.kind === 'conflict';
  const setStatus = (next: SaveStatus) => {
    status = next;
    for (const listener of listeners) listener();
  };

  async function writeOnce(): Promise<void> {
    // Stan jest niemutowalny i zmienia się tylko między krokami i poleceniami, więc odczyt
    // daje spójną migawkę — nigdy ze środka polecenia (T:TIME-T06).
    const state = engine.getState();
    if (state === lastSaved) return;
    const nextRevision = (revision ?? 0) + 1;
    const serialized = serializeSnapshot(
      state,
      { gameBuildVersion: options.buildVersion, revision: nextRevision, savedAt: options.now() },
      context,
    );
    if (!serialized.ok) {
      setStatus({ kind: 'error', message: `Stan gry nie przeszedł walidacji zapisu` });
      return;
    }
    setStatus({ kind: 'saving' });
    const result = await store.write(serialized.json, revision);
    if (result.ok) {
      revision = nextRevision;
      lastSaved = state;
      setStatus({ kind: 'saved', revision });
    } else if (result.reason === 'conflict') {
      setStatus({ kind: 'conflict', message: result.message });
    } else {
      setStatus({ kind: 'error', message: result.message });
    }
  }

  return {
    save() {
      if (lostWriterRole()) return Promise.resolve();
      if (running) {
        again = true;
        return running;
      }
      running = (async () => {
        do {
          again = false;
          await writeOnce();
        } while (again && !lostWriterRole());
      })().finally(() => {
        running = null;
      });
      return running;
    },
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// SAVE-02: zapis po ważnych działaniach. Każde polecenie zmieniające stan, poza zmianą tempa,
// jest ważne — przyszłe polecenia (zatrudnienie, kontrakt, oddanie, zakup) są objęte domyślnie.
export function isAutosaveTrigger(command: Command): boolean {
  return command.type !== 'SetSpeed';
}

export type AutosaveTimers = {
  setInterval(callback: () => void, ms: number): number;
  clearInterval(handle: number): void;
};

export function attachAutosave(
  manager: SaveManager,
  engine: Engine,
  options: {
    intervalMs?: number;
    timers?: AutosaveTimers;
    onBackground?: (listener: () => void) => () => void;
  } = {},
): () => void {
  const timers = options.timers ?? {
    setInterval: (callback, ms) => window.setInterval(callback, ms),
    clearInterval: (handle) => window.clearInterval(handle),
  };
  const save = () => void manager.save();
  const stopCommands = engine.subscribeCommands((command) => {
    if (isAutosaveTrigger(command)) save();
  });
  const interval = timers.setInterval(save, options.intervalMs ?? AUTOSAVE_INTERVAL_MS);
  // Zapis przy przejściu do tła — dodatkowo; trwałość nie opiera się na zamknięciu strony.
  const stopBackground = options.onBackground?.(save) ?? (() => undefined);
  return () => {
    stopCommands();
    timers.clearInterval(interval);
    stopBackground();
  };
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded'; state: GameState; savedState: GameState; revision: number | null }
  | { kind: 'error'; error: SnapshotError; revision: number | null };

// SAVE-03 (Z): wznowienie w zapisanym momencie, na pauzie, bez nadrabiania czasu poza grą.
export async function loadGame(store: SaveStore, context: ValidationContext): Promise<LoadResult> {
  const { current } = await store.read();
  if (current === null) return { kind: 'empty' };
  const parsed = parseSnapshot(current, context);
  if (!parsed.ok) return { kind: 'error', error: parsed.error, revision: revisionOf(current) };
  const savedState = parsed.envelope.state;
  return {
    kind: 'loaded',
    state: pausedForResume(savedState),
    savedState,
    revision: parsed.envelope.revision,
  };
}

export function pausedForResume(state: GameState): GameState {
  return state.mission.speed === 0 ? state : { ...state, mission: { ...state.mission, speed: 0 } };
}
