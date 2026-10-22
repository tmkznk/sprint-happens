import type { BalanceConfig } from '../domain/config';
import type { Departure, Employee, EmployeeId } from '../domain/employees';
import type { FurnitureId } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import { createAgent, type Task } from '../domain/movement';
import type { GameState } from '../domain/state';
import { interactionCells } from '../world/geometry';
import { cellKey, neighbours } from '../world/movement/grid';
import { occupiedCellKeys, removeAgent } from '../world/movement/movement';
import { movementEnvFor } from '../world/movement/officeEnv';
import { OFFICE_LAYOUT } from '../world/officeLayout';

// OFF-04 (Z): wolne biurko przydziela się automatycznie — pierwsze według ID mebla.
export function firstFreeDesk(state: GameState): FurnitureId | null {
  const taken = new Set(Object.values(state.staff.employees).map((employee) => employee.deskId));
  const desk = Object.values(state.world.furniture)
    .filter((item) => item.type === 'desk' && !taken.has(item.id))
    .sort((a, b) => compareIds(a.id, b.id))[0];
  return desk?.id ?? null;
}

export function freeDeskCount(state: GameState): number {
  const taken = new Set(Object.values(state.staff.employees).map((employee) => employee.deskId));
  return Object.values(state.world.furniture).filter(
    (item) => item.type === 'desk' && !taken.has(item.id),
  ).length;
}

// Dokąd idzie pracownik: do punktu korzystania z własnego biurka; bez biurka — na wolne pole
// w pobliżu wejścia, aby nie blokować drzwi (EMP-04: pobiera pensję, ale nie pracuje).
export function tasksForEmployee(
  state: GameState,
  employee: Pick<Employee, 'deskId'>,
  from: GridPoint,
  config: BalanceConfig,
): Task[] {
  const desk = employee.deskId ? state.world.furniture[employee.deskId] : undefined;
  const deskPoint = desk ? interactionCells(desk)[0] : undefined;
  if (deskPoint) return [{ kind: 'goTo', cell: deskPoint }];
  const standing = nearestFreeCell(state, config, from, true);
  return standing ? [{ kind: 'goTo', cell: standing }] : [];
}

// Pole wejścia nowej postaci: drzwi wejściowe, a gdy są zajęte — najbliższe wolne pole.
export function spawnCell(state: GameState, config: BalanceConfig): GridPoint | null {
  const entrance = OFFICE_LAYOUT.doors.find((door) => door.isEntrance)?.position;
  return entrance ? nearestFreeCell(state, config, entrance, false) : null;
}

// BFS po przejezdnych polach; pomija pola zajęte przez postacie, cele innych postaci oraz —
// opcjonalnie — drzwi i punkty korzystania z mebli (miejsca, w których nie wolno stać).
function nearestFreeCell(
  state: GameState,
  config: BalanceConfig,
  from: GridPoint,
  avoidUsePoints: boolean,
): GridPoint | null {
  const { grid, destinations } = movementEnvFor(state, config);
  const { agents } = state.world.movement;
  const blocked = new Set(agents.flatMap(occupiedCellKeys));
  for (const agent of agents) {
    for (const task of agent.tasks) if (task.kind === 'goTo') blocked.add(cellKey(task.cell));
  }
  if (avoidUsePoints) {
    for (const destination of destinations) blocked.add(cellKey(destination.cell));
    for (const door of OFFICE_LAYOUT.doors) blocked.add(cellKey(door.position));
  }
  const seen = new Set([cellKey(from)]);
  const queue: GridPoint[] = [from];
  while (queue.length > 0) {
    const cell = queue.shift();
    if (!cell) break;
    if (grid.passable(cell) && !blocked.has(cellKey(cell))) return cell;
    for (const next of neighbours(cell)) {
      if (seen.has(cellKey(next)) || !grid.passable(next)) continue;
      seen.add(cellKey(next));
      queue.push(next);
    }
  }
  return null;
}

export function addEmployeeAgent(
  state: GameState,
  employee: Employee,
  config: BalanceConfig,
): GameState | null {
  const spawn = spawnCell(state, config);
  if (!spawn) return null;
  const agent = createAgent(employee.id, spawn, tasksForEmployee(state, employee, spawn, config));
  const agents = [...state.world.movement.agents, agent].sort((a, b) => compareIds(a.id, b.id));
  return {
    ...state,
    world: { ...state.world, movement: { ...state.world.movement, agents } },
  };
}

export function employeeOf(state: GameState, id: EmployeeId): Employee | undefined {
  return state.staff.employees[id];
}

// ID `rodzaj-n` porównywane numerycznie, aby `desk-10` było po `desk-9`.
export function compareIds(a: string, b: string): number {
  const [kindA = '', numberA = '0'] = a.split('-');
  const [kindB = '', numberB = '0'] = b.split('-');
  return kindA === kindB ? Number(numberA) - Number(numberB) : kindA < kindB ? -1 : 1;
}

// EMP-08 (Z): odejście (zwolnienie lub samodzielne) ma jednakowe skutki: zwalnia biurko,
// przydział, rezerwacje i kolejki postaci; postęp funkcji i napraw zostaje przy projekcie;
// dzisiejsza dniówka pozostaje należna (FIN-03); premia PM-a znika, bo wynika z przydziału.
// Brak odpraw i wpływu na resztę zespołu.
export function removeEmployee(
  state: GameState,
  employeeId: EmployeeId,
  reason: Departure['reason'],
): GameState {
  const employee = state.staff.employees[employeeId];
  if (!employee) return state;
  const employees = Object.fromEntries(
    Object.entries(state.staff.employees).filter(([id]) => id !== employeeId),
  ) as typeof state.staff.employees;
  return {
    ...state,
    staff: {
      ...state.staff,
      employees,
      departures: [
        ...state.staff.departures,
        { employeeId, name: employee.name, day: state.mission.day, reason },
      ],
    },
    world: { ...state.world, movement: removeAgent(state.world.movement, employeeId) },
  };
}
