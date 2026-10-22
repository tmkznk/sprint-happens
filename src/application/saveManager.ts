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
  // Zapisuje i potwierdza, że bieżący stan jest utrwalony (T:PWA-T02 — warunek aktualizacji).
  // false: błąd zapisu, konflikt z inną kartą albo stan zmienił się w trakcie zapisu.
  flush(): Promise<boolean>;
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
  // SH-039: zapis w magazynie jest uszkodzony (gra z kopii lub nowa misja po potwierdzeniu) —
  // pierwszy zapis nie przesuwa go do kopii awaryjnej, aby jej nie zniszczyć.
  keepPreviousOnFirstWrite?: boolean;
  now(): string;
};

export function createSaveManager(options: SaveManagerOptions): SaveManager {
  const { engine, store, context } = options;
  let revision = options.storedRevision;
  let lastSaved = options.savedState;
  let keepPrevious = options.keepPreviousOnFirstWrite ?? false;
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
    const result = await store.write(serialized.json, revision, { keepPrevious });
    if (result.ok) {
      keepPrevious = false;
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
    async flush() {
      await this.save();
      return !lostWriterRole() && status.kind !== 'error' && lastSaved === engine.getState();
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

// Poprawna kopia awaryjna gotowa do wczytania na ekranie odzyskiwania.
export type Backup = { state: GameState; day: number; savedAt: string };

// Błąd odczytu: niepoprawny zapis albo niedostępna pamięć przeglądarki (np. tryb prywatny).
export type LoadErrorCode = SnapshotError['code'] | 'storageUnavailable';
export type LoadError = { code: LoadErrorCode; issues: string[] };

export type LoadResult =
  | { kind: 'empty' }
  // `savedState` null — stan zmigrowany w pamięci; pierwszy zapis utrwali nowy format,
  // a oryginał trafi do kopii awaryjnej (SAVE-T05).
  | { kind: 'loaded'; state: GameState; savedState: GameState | null; revision: number | null }
  // `backup` — poprawna kopia; null, gdy jej brak albo zapis jest z nowszej wersji (A6b).
  | { kind: 'error'; error: LoadError; revision: number | null; backup: Backup | null };

// SAVE-03 (Z): wznowienie w zapisanym momencie, na pauzie, bez nadrabiania czasu poza grą.
// T:SAVE-T05, decyzja SH-004 A6: uszkodzony zapis nigdy nie uruchamia nowej misji ani kopii
// automatycznie — wynik opisuje błąd i dostępną kopię, a decyzję podejmuje gracz.
export async function loadGame(store: SaveStore, context: ValidationContext): Promise<LoadResult> {
  let saves: Awaited<ReturnType<SaveStore['read']>>;
  try {
    saves = await store.read();
  } catch (error) {
    // T:SAVE-T03: błąd magazynu jest widoczny — nie zawieszamy startu i nie udajemy pustego zapisu.
    return {
      kind: 'error',
      error: { code: 'storageUnavailable', issues: [String(error)] },
      revision: null,
      backup: null,
    };
  }
  const { current, previous } = saves;
  if (current === null) return { kind: 'empty' };
  const parsed = parseSnapshot(current, context);
  if (!parsed.ok) {
    const backup = parsed.error.code === 'newerVersion' ? null : readBackup(previous, context);
    return { kind: 'error', error: parsed.error, revision: revisionOf(current), backup };
  }
  const savedState = parsed.envelope.state;
  return {
    kind: 'loaded',
    state: pausedForResume(savedState),
    savedState: parsed.migratedFrom === null ? savedState : null,
    revision: parsed.envelope.revision,
  };
}

function readBackup(previous: string | null, context: ValidationContext): Backup | null {
  if (previous === null) return null;
  const parsed = parseSnapshot(previous, context);
  if (!parsed.ok) return null;
  const { state, savedAt } = parsed.envelope;
  return { state: pausedForResume(state), day: state.mission.day, savedAt };
}

export function pausedForResume(state: GameState): GameState {
  return state.mission.speed === 0 ? state : { ...state, mission: { ...state.mission, speed: 0 } };
}
