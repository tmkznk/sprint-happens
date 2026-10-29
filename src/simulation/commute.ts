import type { BalanceConfig } from '../domain/config';
import type { GridPoint } from '../domain/grid';
import type { EmployeeId } from '../domain/employees';
import { createAgent, type Task } from '../domain/movement';
import type { GameState } from '../domain/state';
import { cellKey, neighbours, sameCell } from '../world/movement/grid';
import {
  occupiedCellKeys,
  redirectAgent,
  removeAgent,
  stepMovement,
} from '../world/movement/movement';
import { movementEnvFor } from '../world/movement/officeEnv';
import { cellKindAt, officeLayoutOf, type OfficeLayout } from '../world/officeLayout';
import { compareIds, freeStandingCell, tasksForEmployee } from './staff';

// Przejścia postaci między domem a biurem: przyjście przed 9:00 (TIME-04) i wyjście po 17:00
// (TIME-08). W tych fazach biegnie wyłącznie ruch — bez pracy, potrzeb, zadowolenia, zdarzeń
// i kosztów; zegar dnia stoi.

// Bezpiecznik przejścia (R): limit w krokach, aby wynik nie zależał od tempa (TIME-T01).
export function maxTransitSteps(config: BalanceConfig): number {
  return Math.round((config.simulation.maxTransitSeconds * 1000) / config.simulation.stepMs);
}

function entranceOf(state: GameState): GridPoint {
  const entrance = officeLayoutOf(state).doors.find((door) => door.isEntrance)?.position;
  if (!entrance) throw new Error('Biuro bez drzwi wejściowych');
  return entrance;
}

// O 17:00 wszyscy przerywają czynność (praca, kawa, kanapa, kolejka) i idą do drzwi wejściowych;
// rezerwacje miejsc są zwalniane od razu (MOVE-03). Tempo bez zmian — gracz może przyspieszyć.
export function beginLeaving(state: GameState): GameState {
  const door = entranceOf(state);
  let movement = state.world.movement;
  for (const agent of state.world.movement.agents) {
    movement = redirectAgent(movement, agent.id, [{ kind: 'goTo', cell: door }]);
  }
  return {
    ...state,
    mission: { ...state.mission, phase: 'leaving', transitSteps: 0 },
    world: { ...state.world, movement },
  };
}

// Krok wyjścia: ruch, a kto stoi w drzwiach (bez trwającego przejścia), znika z biura.
// Gdy biuro jest puste albo minął limit przejścia — koniec pracy na pauzie (raport, rozliczenie).
export function advanceLeaving(state: GameState, config: BalanceConfig): GameState {
  const door = entranceOf(state);
  let movement = state.world.movement;
  if (movement.agents.length > 0) {
    movement = stepMovement(movement, movementEnvFor(state, config));
    for (const agent of movement.agents) {
      if (agent.move === null && sameCell(agent.cell, door)) {
        movement = removeAgent(movement, agent.id);
      }
    }
  }
  const transitSteps = state.mission.transitSteps + 1;

  if (movement.agents.length === 0 || transitSteps >= maxTransitSteps(config)) {
    return {
      ...state,
      mission: { ...state.mission, phase: 'workEnded', speed: 0, transitSteps: 0 },
      world: { ...state.world, movement: { step: movement.step, agents: [], reservations: {} } },
    };
  }
  return {
    ...state,
    mission: { ...state.mission, transitSteps },
    world: { ...state.world, movement },
  };
}

// Pole wejścia (TIME-04): jedyne pole podłogi przy drzwiach wejściowych — mieści jedną osobę.
export function entryCell(layout: OfficeLayout): GridPoint {
  const door = layout.doors.find((d) => d.isEntrance)?.position;
  if (!door) throw new Error('Biuro bez drzwi wejściowych');
  const floor = neighbours(door).filter((cell) => cellKindAt(layout, cell) === 'floor');
  const [cell] = floor;
  if (!cell || floor.length !== 1) throw new Error('Drzwi wejściowe bez jednego pola wejścia');
  return cell;
}

// TIME-04, TIME-05: po „Następny dzień” biuro jest puste, a wszyscy pracownicy czekają przed
// wejściem w stałej kolejności ID (deterministycznie). Zegar dnia stoi na 9:00.
export function beginArriving(state: GameState): GameState {
  const entryQueue = Object.keys(state.staff.employees).sort(compareIds) as EmployeeId[];
  return {
    ...state,
    mission: { ...state.mission, phase: 'arriving', transitSteps: 0 },
    staff: { ...state.staff, entryQueue },
    world: { ...state.world, movement: { ...state.world.movement, agents: [], reservations: {} } },
  };
}

// Krok przyjścia: gdy pole wejścia jest wolne, wchodzi następna osoba z kolejki; potem ruch.
// Gdy wszyscy doszli (albo minął limit przejścia) — dzień pracy od 9:00, tempo bez zmian.
// Bez pracy, potrzeb, zadowolenia, zdarzeń i kosztów.
export function advanceArriving(state: GameState, config: BalanceConfig): GameState {
  const entry = entryCell(officeLayoutOf(state));
  let current = state;
  const [next, ...rest] = current.staff.entryQueue;
  if (next !== undefined && cellIsFree(current, config, entry)) {
    current = withAgentAt(current, config, next, entry, entry);
    current = { ...current, staff: { ...current.staff, entryQueue: rest } };
  }
  let movement = current.world.movement;
  if (movement.agents.length > 0)
    movement = stepMovement(movement, movementEnvFor(current, config));
  current = { ...current, world: { ...current.world, movement } };
  const transitSteps = state.mission.transitSteps + 1;

  const everyoneIn =
    current.staff.entryQueue.length === 0 &&
    movement.agents.every(
      (a) => a.move === null && (a.status === 'arrived' || a.tasks.length === 0),
    );
  if (!everyoneIn && transitSteps < maxTransitSteps(config)) {
    return { ...current, mission: { ...current.mission, transitSteps } };
  }
  // Bezpiecznik: kto nie zdążył wejść, staje od razu na swoim celu — nikt nie zostaje poza biurem.
  for (const id of current.staff.entryQueue) current = placeDirectly(current, config, id, entry);
  return {
    ...current,
    mission: { ...current.mission, phase: 'working', transitSteps: 0 },
    staff: { ...current.staff, entryQueue: [] },
  };
}

// Pole przejezdne i nikt go nie zajmuje ani nie wchodzi na nie (T:MOVE-09).
function cellIsFree(state: GameState, config: BalanceConfig, cell: GridPoint): boolean {
  return freeCellTest(state, config)(cell);
}

function freeCellTest(state: GameState, config: BalanceConfig): (cell: GridPoint) => boolean {
  const { grid } = movementEnvFor(state, config);
  const occupied = new Set(state.world.movement.agents.flatMap(occupiedCellKeys));
  return (cell) => grid.passable(cell) && !occupied.has(cellKey(cell));
}

// Postać pracownika na polu `cell`, z celem jak po zatrudnieniu (biurko albo wolne pole do stania
// poza polem wejścia, by nie blokować kolejnych osób). Agenci posortowani po ID.
function withAgentAt(
  state: GameState,
  config: BalanceConfig,
  id: EmployeeId,
  cell: GridPoint,
  entry: GridPoint,
  tasks?: Task[],
): GameState {
  const employee = state.staff.employees[id];
  if (!employee) return state;
  const agent = createAgent(
    id,
    cell,
    tasks ?? tasksForEmployee(state, employee, cell, config, [entry]),
  );
  const agents = [...state.world.movement.agents, agent].sort((a, b) => compareIds(a.id, b.id));
  return {
    ...state,
    world: { ...state.world, movement: { ...state.world.movement, agents } },
  };
}

// Bezpiecznik przyjścia: cel z `tasksForEmployee` (punkt biurka albo wolne pole), a gdy zajęty —
// najbliższe wolne pole do stania; w ostateczności dowolne wolne pole biura.
function placeDirectly(
  state: GameState,
  config: BalanceConfig,
  id: EmployeeId,
  entry: GridPoint,
): GameState {
  const employee = state.staff.employees[id];
  if (!employee) return state;
  const tasks = tasksForEmployee(state, employee, entry, config, [entry]);
  const goal = tasks[0]?.kind === 'goTo' ? tasks[0].cell : null;
  if (goal && cellIsFree(state, config, goal)) {
    return withAgentAt(state, config, id, goal, entry, tasks);
  }
  const cell =
    freeStandingCell(state, config, goal ?? entry, [entry]) ?? firstFreeCell(state, config, entry);
  if (!cell) throw new Error(`Brak wolnego pola dla ${id}`);
  // Z biurkiem — dojdzie do niego, gdy się zwolni; bez biurka — stoi tam, gdzie go postawiono.
  return withAgentAt(
    state,
    config,
    id,
    cell,
    entry,
    employee.deskId ? tasks : [{ kind: 'goTo', cell }],
  );
}

// Ostateczność, gdy BFS nie znajdzie pola (np. odcięte wejście): pierwsze wolne pole siatki
// w kolejności wierszy — najpierw do stania (bez drzwi, punktów mebli i pola wejścia), potem dowolne.
function firstFreeCell(
  state: GameState,
  config: BalanceConfig,
  entry: GridPoint,
): GridPoint | null {
  const layout = officeLayoutOf(state);
  const { destinations } = movementEnvFor(state, config);
  const reserved = new Set([
    cellKey(entry),
    ...destinations.map((d) => cellKey(d.cell)),
    ...layout.doors.map((d) => cellKey(d.position)),
  ]);
  const cells: GridPoint[] = [];
  for (let y = 0; y < layout.size.height; y++) {
    for (let x = 0; x < layout.size.width; x++) cells.push({ x, y });
  }
  const free = cells.filter(freeCellTest(state, config));
  return free.find((cell) => !reserved.has(cellKey(cell))) ?? free[0] ?? null;
}
