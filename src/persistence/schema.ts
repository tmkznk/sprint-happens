import { z } from 'zod';
import type { BalanceConfig } from '../domain/config';
import { ROTATIONS, type FurnitureId } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import { SPEEDS, type GameState } from '../domain/state';
import { DAY_LENGTH_MS } from '../simulation/time';
import { occupiedCells } from '../world/geometry';
import { cellKindAt, type OfficeLayout } from '../world/officeLayout';

// T:SAVE-T02, SAVE-T06 — schemat migawki stanu gry. Każdy system domenowy dodaje tu swój
// fragment; test typów w schema.test.ts nie przejdzie, jeśli GameState i schemat się rozjadą.

export type ValidationContext = { config: BalanceConfig; layout: OfficeLayout };

const furnitureId = z.custom<FurnitureId>(
  (value) => typeof value === 'string' && /^furniture-[1-9]\d*$/.test(value),
  'Niepoprawne ID mebla',
);

const point = z.strictObject({ x: z.int(), y: z.int() });

const missionSchema = z.strictObject({
  status: z.enum(['active', 'won', 'bankrupt']),
  day: z.int().min(1),
  phase: z.enum(['working', 'workEnded', 'settled']),
  speed: z.literal(SPEEDS),
  timeInDayMs: z.int().min(0).max(DAY_LENGTH_MS),
  report: z.strictObject({ day: z.int().min(1), cashAfterSettlement: z.int() }).nullable(),
});

const financeSchema = z.strictObject({ cash: z.int() });

const furnitureSchema = z.strictObject({
  id: furnitureId,
  type: z.enum(['desk', 'sofa', 'coffeeMachine']),
  origin: point,
  rotation: z.literal(ROTATIONS),
});

const worldSchema = z.strictObject({ furniture: z.record(furnitureId, furnitureSchema) });

const idsSchema = z.record(z.string().regex(/^[a-z][a-zA-Z]*$/), z.int().min(0));

export const gameStateShape = z.strictObject({
  mission: missionSchema,
  finance: financeSchema,
  world: worldSchema,
  ids: idsSchema,
  // TIME-T04: stan generatora losowego jest zapisywany, aby wczytanie nie przelosowało wyników.
  rng: z.uint32(),
});

type Issue = { path: (string | number)[]; message: string };

// Spójność, której nie wyrazi sam kształt danych: ID, referencje, zajętość pól, fazy dnia.
export function consistencyIssues(state: GameState, context: ValidationContext): Issue[] {
  return [...missionIssues(state, context), ...furnitureIssues(state, context)];
}

function missionIssues(state: GameState, { config }: ValidationContext): Issue[] {
  const issues: Issue[] = [];
  const { mission } = state;
  if (mission.timeInDayMs % config.simulation.stepMs !== 0) {
    issues.push({ path: ['mission', 'timeInDayMs'], message: 'Czas dnia poza siatką kroków' });
  }
  const dayFinished = mission.timeInDayMs === DAY_LENGTH_MS;
  if (mission.phase === 'working' && dayFinished) {
    issues.push({ path: ['mission', 'phase'], message: 'Dzień pracy po upływie 600 s' });
  }
  if (mission.phase !== 'working' && (!dayFinished || mission.speed !== 0)) {
    issues.push({ path: ['mission', 'phase'], message: 'Po końcu pracy symulacja musi stać' });
  }
  if (mission.status !== 'active' && mission.speed !== 0) {
    issues.push({ path: ['mission', 'speed'], message: 'Zakończona misja nie może biec' });
  }
  const settled = mission.phase === 'settled';
  if (
    settled !== (mission.report !== null) ||
    (mission.report && mission.report.day !== mission.day)
  ) {
    issues.push({ path: ['mission', 'report'], message: 'Raport niezgodny z fazą lub dniem' });
  }
  return issues;
}

function furnitureIssues(state: GameState, { layout }: ValidationContext): Issue[] {
  const issues: Issue[] = [];
  const taken = new Map<string, string>();
  const allocated = state.ids.furniture ?? 0;
  for (const [key, item] of Object.entries(state.world.furniture)) {
    const path = ['world', 'furniture', key];
    if (item.id !== key) issues.push({ path, message: 'Klucz różny od ID mebla' });
    if (Number(item.id.split('-')[1]) > allocated) {
      issues.push({ path, message: 'ID mebla spoza przydzielonej sekwencji' });
    }
    for (const cell of occupiedCells(item)) {
      if (cellKindAt(layout, cell) !== 'floor') {
        issues.push({ path, message: `Mebel poza podłogą na polu ${label(cell)}` });
      }
      const other = taken.get(label(cell));
      if (other) issues.push({ path, message: `Mebel koliduje z ${other} na polu ${label(cell)}` });
      taken.set(label(cell), item.id);
    }
  }
  return issues;
}

const label = (cell: GridPoint) => `${cell.x},${cell.y}`;

export function gameStateSchema(context: ValidationContext) {
  return gameStateShape.superRefine((state, ctx) => {
    for (const issue of consistencyIssues(state as GameState, context)) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });
}
