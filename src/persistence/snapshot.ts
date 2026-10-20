import { z } from 'zod';
import type { GameState } from '../domain/state';
import { gameStateSchema, type ValidationContext } from './schema';

// T:SAVE-T05, SAVE-T06 — wersja formatu zapisu. Zmiana kształtu stanu wymaga podniesienia
// wersji i migracji (SH-039).
export const SCHEMA_VERSION = 1;

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
  // Starszy format wymaga migracji (SH-039).
  | 'needsMigration'
  | 'invalidState';

export type SnapshotError = { code: SnapshotErrorCode; issues: string[] };

export type ParseResult =
  { ok: true; envelope: SaveEnvelope } | { ok: false; error: SnapshotError };

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

export function parseSnapshot(json: string, context: ValidationContext): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return failure('invalidJson', ['Zapis nie jest poprawnym JSON']);
  }

  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) return failure('invalidEnvelope', describe(envelope.error));

  const { schemaVersion } = envelope.data;
  if (schemaVersion > SCHEMA_VERSION) {
    return failure('newerVersion', [`Format ${schemaVersion}, obsługiwany ${SCHEMA_VERSION}`]);
  }
  if (schemaVersion < SCHEMA_VERSION) {
    return failure('needsMigration', [`Format ${schemaVersion}, wymagany ${SCHEMA_VERSION}`]);
  }

  const state = gameStateSchema(context).safeParse(envelope.data.state);
  if (!state.success) return failure('invalidState', describe(state.error));

  return { ok: true, envelope: { ...envelope.data, state: state.data as GameState } };
}

function failure(code: SnapshotErrorCode, issues: string[]): ParseResult {
  return { ok: false, error: { code, issues } };
}

function describe(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}
