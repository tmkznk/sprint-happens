import { z } from 'zod';
import type { BalanceConfig } from '../domain/config';
import { OPERATION_KINDS } from '../domain/finance';
import { ROTATIONS, type FurnitureId } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import { SPEEDS, type GameState } from '../domain/state';
import { DAY_LENGTH_MS } from '../simulation/time';
import { occupiedCells } from '../world/geometry';
import { movementEnvFor } from '../world/movement/officeEnv';
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

const financeSchema = z.strictObject({
  openingCash: z.int(),
  cash: z.int(),
  ledger: z.array(
    z.strictObject({
      key: z.string().min(1),
      day: z.int().min(1),
      kind: z.enum(OPERATION_KINDS),
      amount: z.int(),
      ref: z.string().nullable(),
    }),
  ),
  wagesDueToday: z.record(z.string().min(1), z.int().min(0)),
});

const furnitureSchema = z.strictObject({
  id: furnitureId,
  type: z.enum(['desk', 'sofa', 'coffeeMachine']),
  origin: point,
  rotation: z.literal(ROTATIONS),
});

const taskSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('goTo'), cell: point }),
  z.strictObject({
    kind: z.literal('use'),
    destinationIds: z.array(z.string().min(1)).min(1),
    steps: z.int().min(1),
  }),
]);

const agentSchema = z.strictObject({
  id: z.string().min(1),
  cell: point,
  move: z.strictObject({ to: point, elapsed: z.int().min(0) }).nullable(),
  tasks: z.array(taskSchema),
  reservedDestination: z.string().nullable(),
  queuedSince: z.int().min(0).nullable(),
  usedSteps: z.int().min(0),
  path: z.array(point),
  status: z.enum([
    'idle',
    'walking',
    'waiting',
    'yielding',
    'queued',
    'using',
    'arrived',
    'noRoute',
    'deadlocked',
  ]),
  waitedSteps: z.int().min(0),
  yieldingTo: z.string().nullable(),
  yieldHeldSteps: z.int().min(0),
});

const movementSchema = z.strictObject({
  step: z.int().min(0),
  agents: z.array(agentSchema),
  reservations: z.record(z.string(), z.string()),
});

const worldSchema = z.strictObject({
  furniture: z.record(furnitureId, furnitureSchema),
  movement: movementSchema,
});

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
  const issues = [
    ...missionIssues(state, context),
    ...financeIssues(state),
    ...furnitureIssues(state, context),
  ];
  // Ruch sprawdzamy na poprawnym układzie mebli — inaczej mapa przejść byłaby niewiarygodna.
  return issues.length > 0 ? issues : movementIssues(state, context);
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

// SH-027: saldo wynika z księgi, a każda operacja występuje raz.
function financeIssues(state: GameState): Issue[] {
  const issues: Issue[] = [];
  const { finance, mission } = state;
  const total = finance.ledger.reduce((sum, entry) => sum + entry.amount, finance.openingCash);
  if (total !== finance.cash) {
    issues.push({ path: ['finance', 'cash'], message: 'Saldo niezgodne z księgą operacji' });
  }
  const keys = new Set<string>();
  finance.ledger.forEach((entry, index) => {
    const path = ['finance', 'ledger', index];
    if (keys.has(entry.key)) issues.push({ path, message: `Powtórzona operacja ${entry.key}` });
    keys.add(entry.key);
    if (entry.day > mission.day) issues.push({ path, message: 'Operacja z przyszłego dnia' });
  });
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

// T:SAVE-T06 — spójność rezerwacji i pozycji postaci (MOVE-03, MOVE-04, MOVE-09).
function movementIssues(state: GameState, { config, layout }: ValidationContext): Issue[] {
  const issues: Issue[] = [];
  const { agents, reservations, step } = state.world.movement;
  const { grid, destinations } = movementEnvFor(state, config, layout);
  const destinationIds = new Set(destinations.map((destination) => destination.id));
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const taken = new Map<string, string>();

  if (byId.size !== agents.length) {
    issues.push({ path: ['world', 'movement', 'agents'], message: 'Powtórzone ID postaci' });
  }
  agents.forEach((agent, index) => {
    const path = ['world', 'movement', 'agents', index];
    const cells = agent.move ? [agent.cell, agent.move.to] : [agent.cell];
    for (const cell of cells) {
      if (!grid.passable(cell))
        issues.push({ path, message: `Postać na przeszkodzie ${label(cell)}` });
      const other = taken.get(label(cell));
      if (other) issues.push({ path, message: `Pole ${label(cell)} zajęte także przez ${other}` });
      taken.set(label(cell), agent.id);
    }
    if (agent.move) {
      const distance =
        Math.abs(agent.move.to.x - agent.cell.x) + Math.abs(agent.move.to.y - agent.cell.y);
      if (distance !== 1)
        issues.push({ path, message: 'Przejście nie prowadzi na sąsiednie pole' });
      if (agent.move.elapsed >= config.movement.stepsPerCell) {
        issues.push({ path, message: 'Przejście przekracza czas jednego pola' });
      }
    }
    if (
      agent.reservedDestination !== null &&
      reservations[agent.reservedDestination] !== agent.id
    ) {
      issues.push({ path, message: 'Rezerwacja postaci nie jest zapisana w miejscu' });
    }
    if (agent.yieldingTo !== null && !byId.has(agent.yieldingTo)) {
      issues.push({ path, message: 'Ustąpienie na rzecz nieistniejącej postaci' });
    }
    if (agent.queuedSince !== null && agent.queuedSince > step) {
      issues.push({ path, message: 'Kolejka z przyszłości' });
    }
  });
  for (const [destination, holder] of Object.entries(reservations)) {
    const path = ['world', 'movement', 'reservations', destination];
    if (!destinationIds.has(destination))
      issues.push({ path, message: 'Rezerwacja nieistniejącego miejsca' });
    if (byId.get(holder)?.reservedDestination !== destination) {
      issues.push({ path, message: 'Rezerwacja wskazuje postać, która jej nie ma' });
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
