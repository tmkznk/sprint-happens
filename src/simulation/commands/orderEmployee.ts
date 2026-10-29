import type { BalanceConfig } from '../../domain/config';
import type { Employee } from '../../domain/employees';
import type { Furniture } from '../../domain/furniture';
import type { GridPoint } from '../../domain/grid';
import type { ReadonlyAgent, Task } from '../../domain/movement';
import type { GameState } from '../../domain/state';
import { interactionCells, occupiedCells } from '../../world/geometry';
import { cellKey } from '../../world/movement/grid';
import { occupiedCellKeys, redirectAgent } from '../../world/movement/movement';
import { destinationId, movementEnvFor } from '../../world/movement/officeEnv';
import { reachableCells } from '../../world/movement/pathfinding';
import { cellKindAt, officeLayoutOf } from '../../world/officeLayout';
import { isCoffeeBroken } from '../events';
import { OPEN_ENDED_USE } from '../needs';
import { tasksForEmployee } from '../staff';
import { assignDeskTo } from './assignDesk';
import {
  reject,
  type CommandHandler,
  type HandlerOutcome,
  type OrderEmployeeCommand,
  type RejectionCode,
} from './types';

// Sterowanie postaciami (OFF-04, NEED-02, T:ARCH-03): rozkaz zastępuje bieżące zadania postaci
// (ostatni rozkaz wygrywa) i przez istniejący system ruchu — z rezerwacjami i kolejkami — prowadzi
// ją na pole, do ekspresu, na kanapę albo do biurka. Kawa i kanapa to te same przerwy co
// automatyczne (te same parametry B). Po rozkazie automat przerw czeka do progu wyczerpania
// (decyzja 2b, `breakHold`); kanapa z rozkazu ma minimalny czas odpoczynku (decyzja 3c).
export const orderEmployee: CommandHandler<OrderEmployeeCommand> = {
  category: 'workDay',
  execute(state, command, config) {
    const employee = state.staff.employees[command.employeeId];
    if (!employee) return reject('unknownEmployee');
    const agent = state.world.movement.agents.find((a) => a.id === employee.id);
    if (!agent) return reject('employeeAway');

    const { target } = command;
    if (target.kind === 'cell') {
      if (!isFreeReachableFloor(state, config, agent, target.cell)) {
        return reject('unreachableTarget');
      }
      return ordered(state, employee, [{ kind: 'goTo', cell: target.cell }], false);
    }

    const item = state.world.furniture[target.furnitureId];
    if (!item) return reject('unknownFurniture');
    const plan = furnitureOrder(state, employee, item, config);
    if ('code' in plan) return reject(plan.code);
    return ordered(plan.state, employee, plan.tasks, item.type === 'sofa');
  },
};

type FurniturePlan = { state: GameState; tasks: Task[] } | { code: RejectionCode };

function furnitureOrder(
  state: GameState,
  employee: Employee,
  item: Furniture,
  config: BalanceConfig,
): FurniturePlan {
  const points = interactionCells(item);
  const [point] = points;
  if (!point) return { code: 'noAction' };
  switch (item.type) {
    case 'desk': {
      if (employee.deskId === item.id) return { state, tasks: [{ kind: 'goTo', cell: point }] };
      const holder = Object.values(state.staff.employees).find((e) => e.deskId === item.id);
      if (holder) return { code: 'deskTaken' };
      // OFF-04: ta sama zmiana biurka co z karty postaci; poprzednie biurko się zwalnia.
      const assigned = assignDeskTo(state, employee.id, item.id, config);
      return { state: assigned, tasks: [{ kind: 'goTo', cell: point }] };
    }
    case 'coffeeMachine':
    case 'sofa': {
      // Zdarzenie „Ekspres strajkuje”: rozkaz nie omija zepsutego ekspresu.
      if (item.type === 'coffeeMachine' && isCoffeeBroken(state)) return { code: 'coffeeBroken' };
      // Kolejka do dotkniętego mebla (MOVE-03), potem powrót do biurka jak po zwykłej przerwie.
      const destinationIds = points.map((_, index) => destinationId(item.id, index));
      const back = tasksForEmployee(state, employee, point, config);
      return {
        state,
        tasks: [{ kind: 'use', destinationIds, steps: OPEN_ENDED_USE }, ...back],
      };
    }
    default:
      return { code: 'noAction' };
  }
}

function ordered(
  state: GameState,
  employee: Employee,
  tasks: Task[],
  orderedRest: boolean,
): HandlerOutcome {
  const current = state.staff.employees[employee.id] ?? employee;
  return {
    ok: true,
    state: {
      ...state,
      staff: {
        ...state.staff,
        employees: {
          ...state.staff.employees,
          [employee.id]: { ...current, breakHold: true, orderedRest },
        },
      },
      world: {
        ...state.world,
        movement: redirectAgent(state.world.movement, employee.id, tasks),
      },
    },
  };
}

// Wolna podłoga: nie pod meblem, nie punkt korzystania z mebla, bez innej postaci i jej celu,
// osiągalna z bieżącego pola postaci (ściany i drzwi nie są podłogą).
function isFreeReachableFloor(
  state: GameState,
  config: BalanceConfig,
  agent: ReadonlyAgent,
  cell: GridPoint,
): boolean {
  if (cellKindAt(officeLayoutOf(state), cell) !== 'floor') return false;
  const key = cellKey(cell);
  const furniture = Object.values(state.world.furniture);
  const blocked = new Set([
    ...furniture.flatMap(occupiedCells).map(cellKey),
    ...furniture.flatMap(interactionCells).map(cellKey),
  ]);
  for (const other of state.world.movement.agents) {
    if (other.id === agent.id) continue;
    for (const occupied of occupiedCellKeys(other)) blocked.add(occupied);
    for (const task of other.tasks) if (task.kind === 'goTo') blocked.add(cellKey(task.cell));
  }
  if (blocked.has(key)) return false;
  return reachableCells(movementEnvFor(state, config).grid, agent.cell).has(key);
}
