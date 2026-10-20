import type { GridPoint } from './grid';
import type { DeepReadonly } from './readonly';

// Dane ruchu postaci (T:MOVE-01–09) — część stanu gry i zapisu. Algorytmy ruchu są w
// src/world/movement; tutaj wyłącznie typy i konstruktory danych.

type Cell = GridPoint;

export type MovementConfig = {
  // Liczba kroków symulacji na przejście jednego pola (R).
  stepsPerCell: number;
  // Po tylu krokach czekania na stojącą postać szukamy trasy naokoło (R).
  replanAfterSteps: number;
  // Maksymalny czas trzymania pozycji po ustąpieniu, zanim postać wróci do celu (R).
  yieldTimeoutSteps: number;
};

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  stepsPerCell: 4,
  replanAfterSteps: 3,
  yieldTimeoutSteps: 40,
};

// MOVE-02/MOVE-03 (Z): miejsce korzystania (np. ekspres, siedzisko kanapy) obsługuje jedną osobę.
export type Destination = { id: string; cell: Cell };

export type Task =
  | { kind: 'goTo'; cell: Cell }
  // Korzystanie z jednego z wolnych miejsc (np. dowolne siedzisko kanapy) przez `steps` kroków.
  | { kind: 'use'; destinationIds: readonly string[]; steps: number };

export type AgentStatus =
  | 'idle'
  | 'walking'
  | 'waiting'
  | 'yielding'
  | 'queued'
  | 'using'
  | 'arrived'
  // MOVE-08: jawnie rozpoznany brak drogi — UI musi to wyjaśnić graczowi.
  | 'noRoute'
  | 'deadlocked';

export type Agent = {
  id: string;
  // Pole logiczne. W trakcie przejścia postać trzyma także pole docelowe `move.to`
  // (T:MOVE-09) — dlatego dwie postacie nie mogą zająć jednego pola ani minąć się „przez siebie”.
  cell: Cell;
  move: { to: Cell; elapsed: number } | null;
  tasks: Task[];
  reservedDestination: string | null;
  queuedSince: number | null;
  usedSteps: number;
  path: Cell[];
  status: AgentStatus;
  // T:MOVE-05 — dłuższe oczekiwanie zwiększa pierwszeństwo.
  waitedSteps: number;
  yieldingTo: string | null;
  yieldHeldSteps: number;
};

export type MovementState = {
  step: number;
  agents: Agent[];
  // ID miejsca → ID postaci, która je zarezerwowała (MOVE-03: rezerwacja przed wyruszeniem).
  reservations: Record<string, string>;
};

export function createAgent(id: string, cell: Cell, tasks: Task[] = []): Agent {
  return {
    id,
    cell,
    move: null,
    tasks,
    reservedDestination: null,
    queuedSince: null,
    usedSteps: 0,
    path: [],
    status: 'idle',
    waitedSteps: 0,
    yieldingTo: null,
    yieldHeldSteps: 0,
  };
}

export function createMovementState(agents: Agent[]): MovementState {
  return {
    step: 0,
    agents: [...agents].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    reservations: {},
  };
}

export type ReadonlyAgent = DeepReadonly<Agent>;
export type ReadonlyMovementState = DeepReadonly<MovementState>;
