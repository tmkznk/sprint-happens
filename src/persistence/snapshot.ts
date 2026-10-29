import { z } from 'zod';
import type { GameState } from '../domain/state';
import { gameStateSchema, type ValidationContext } from './schema';

// T:SAVE-T05, SAVE-T06 — wersja formatu zapisu. Zmiana kształtu stanu wymaga podniesienia
// wersji i dopisania migracji z poprzedniej wersji do MIGRATIONS (SH-039).
// Wersja 2: stan prologu (`prologue`). Wersja 3: przyjście i wyjście (`mission.transitSteps`,
// `staff.entryQueue`). Wersja 4: rozkazy dla postaci (`breakHold`, `orderedRest` pracownika).
export const SCHEMA_VERSION = 4;

// T:SAVE-T05 — migracja stanu z wersji N do N+1. Dostaje głęboką kopię danych (nigdy oryginał)
// i zwraca nowy kształt; błąd zgłasza wyjątkiem. Wynik przechodzi pełną walidację schematu.
export type Migration = (state: unknown) => unknown;

// Klucz — wersja źródłowa.
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // 1 → 2: zapisy sprzed prologu to właściwa misja.
  1: (input) => ({ ...(input as Record<string, unknown>), prologue: null }),
  // 2 → 3: przyjście i wyjście. Zapis po 17:00 (koniec pracy, rozliczenie) miał wszystkich
  // w biurze — teraz biuro jest wtedy puste.
  2: (input) => {
    const state = input as {
      mission: Record<string, unknown>;
      staff: Record<string, unknown>;
      world: { movement: Record<string, unknown> };
    };
    state.mission.transitSteps = 0;
    state.staff.entryQueue = [];
    if (state.mission.phase === 'workEnded' || state.mission.phase === 'settled') {
      state.world.movement.agents = [];
      state.world.movement.reservations = {};
    }
    return state;
  },
  // 3 → 4: rozkazy dla postaci — starsze zapisy nie miały rozkazów ani wstrzymania przerw.
  3: (input) => {
    const state = input as { staff: { employees: Record<string, Record<string, unknown>> } };
    for (const employee of Object.values(state.staff.employees)) {
      employee.breakHold = false;
      employee.orderedRest = false;
    }
    return state;
  },
};

export type FormatOptions = { version: number; migrations: Readonly<Record<number, Migration>> };

const CURRENT_FORMAT: FormatOptions = { version: SCHEMA_VERSION, migrations: MIGRATIONS };

// T:SAVE-T06 (decyzja SH-004 B7): koperta zapisu.
export type SaveEnvelope = {
  schemaVersion: number;
  gameBuildVersion: string;
  // Rośnie z każdym zapisem — pozwala wykryć starszy stan przy dwóch kartach (SH-004 A5).
  revision: number;
  // Wyłącznie diagnostyka; nigdy nie służy do naliczania czasu offline (TIME-07).
  savedAt: string;
  state: GameState;
};

export type SnapshotMeta = Omit<SaveEnvelope, 'schemaVersion' | 'state'>;

export type SnapshotErrorCode =
  | 'invalidJson'
  | 'invalidEnvelope'
  // SH-004 A6b: zapis z nowszej wersji gry — nie wczytywać i nie nadpisywać.
  | 'newerVersion'
  // Starszy format bez ścieżki migracji do bieżącej wersji.
  | 'needsMigration'
  // Migracja zgłosiła błąd albo jej wynik nie przeszedł walidacji — oryginał pozostaje nietknięty.
  | 'migrationFailed'
  | 'invalidState';

export type SnapshotError = { code: SnapshotErrorCode; issues: string[] };

export type ParseResult =
  // `migratedFrom` — wersja źródłowa, gdy zapis zmigrowano w pamięci (zapis w magazynie bez zmian
  // do pierwszego udanego zapisu, który przesunie oryginał do kopii awaryjnej).
  | { ok: true; envelope: SaveEnvelope; migratedFrom: number | null }
  | { ok: false; error: SnapshotError };

export type SerializeResult = { ok: true; json: string } | { ok: false; error: SnapshotError };

const envelopeSchema = z.strictObject({
  schemaVersion: z.int().min(1),
  gameBuildVersion: z.string().min(1),
  revision: z.int().min(0),
  savedAt: z.string().min(1),
  state: z.unknown(),
});

// Serializacja → walidacja tego, co faktycznie trafi do zapisu (SH-004 B6). Ścisła walidacja
// odczytanego tekstu odrzuca funkcje, obiekty renderera, DOM i wartości, których JSON nie
// przenosi (np. NaN, undefined) — znikają lub zmieniają typ i nie spełniają schematu.
export function serializeSnapshot(
  state: GameState,
  meta: SnapshotMeta,
  context: ValidationContext,
): SerializeResult {
  const envelope: SaveEnvelope = { schemaVersion: SCHEMA_VERSION, ...meta, state };
  const json = JSON.stringify(envelope);
  const check = parseSnapshot(json, context);
  return check.ok ? { ok: true, json } : check;
}

export function parseSnapshot(
  json: string,
  context: ValidationContext,
  format: FormatOptions = CURRENT_FORMAT,
): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return failure('invalidJson', ['Zapis nie jest poprawnym JSON']);
  }

  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) return failure('invalidEnvelope', describe(envelope.error));

  const { schemaVersion } = envelope.data;
  if (schemaVersion > format.version) {
    return failure('newerVersion', [`Format ${schemaVersion}, obsługiwany ${format.version}`]);
  }

  let data: unknown = envelope.data.state;
  if (schemaVersion < format.version) {
    // Migracja na kopii w pamięci (SAVE-T05): oryginalny tekst zapisu nie jest modyfikowany.
    data = structuredClone(data);
    for (let version = schemaVersion; version < format.version; version++) {
      const migrate = format.migrations[version];
      if (!migrate) {
        return failure('needsMigration', [`Brak migracji z formatu ${version} do ${version + 1}`]);
      }
      try {
        data = migrate(data);
      } catch (error) {
        return failure('migrationFailed', [
          `Migracja ${version} → ${version + 1}: ${String(error)}`,
        ]);
      }
    }
  }

  const state = gameStateSchema(context).safeParse(data);
  if (!state.success) {
    const code = schemaVersion < format.version ? 'migrationFailed' : 'invalidState';
    return failure(code, describe(state.error));
  }

  return {
    ok: true,
    envelope: { ...envelope.data, schemaVersion: format.version, state: state.data as GameState },
    migratedFrom: schemaVersion < format.version ? schemaVersion : null,
  };
}

function failure(code: SnapshotErrorCode, issues: string[]): ParseResult {
  return { ok: false, error: { code, issues } };
}

function describe(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}
