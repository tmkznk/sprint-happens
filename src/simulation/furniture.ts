import type { BalanceConfig } from '../domain/config';
import type { Employee, EmployeeId } from '../domain/employees';
import { ROTATIONS, type Furniture, type FurnitureId, type Rotation } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import type { GameState } from '../domain/state';
import { interactionCells, occupiedCells } from '../world/geometry';
import { validateAccess } from '../world/movement/access';
import { cellKey } from '../world/movement/grid';
import { occupiedCellKeys } from '../world/movement/movement';
import { cellKindAt, officeLayoutOf } from '../world/officeLayout';
import { tasksForEmployee } from './staff';

// OFF-05 (Z): niedozwolone ustawienie jest blokowane i wyjaśniane komunikatem.
export type PlacementRejection =
  | 'invalidRotation'
  | 'outOfFloor'
  | 'collision'
  // Na polu stoi osoba — mebel nie może jej „przykryć”.
  | 'occupiedByPerson'
  // Ustawienie odcina wymagany dostęp (MOVE-06, decyzja SH-003).
  | 'blocksAccess';

// Wspólna walidacja dla polecenia i podglądu w trybie edycji — UI nie ma własnych reguł.
export function validatePlacement(
  state: GameState,
  furnitureId: FurnitureId,
  origin: GridPoint,
  rotation: Rotation,
): PlacementRejection | null {
  const item = state.world.furniture[furnitureId];
  if (!item) return 'collision';
  return validateCandidate(state, { ...item, origin, rotation });
}

// Walidacja mebla w docelowym położeniu — istniejącego (przeniesienie) albo nowego (zakup).
// Mebel o tym samym ID co kandydat jest pomijany jako „inne wyposażenie”.
export function validateCandidate(
  state: GameState,
  candidate: Furniture,
): PlacementRejection | null {
  if (!(ROTATIONS as readonly number[]).includes(candidate.rotation)) return 'invalidRotation';
  const layout = officeLayoutOf(state);
  const cells = occupiedCells(candidate);
  if (cells.some((cell) => cellKindAt(layout, cell) !== 'floor')) return 'outOfFloor';

  const others = Object.values(state.world.furniture).filter((other) => other.id !== candidate.id);
  const taken = new Set(others.flatMap(occupiedCells).map(cellKey));
  if (cells.some((cell) => taken.has(cellKey(cell)))) return 'collision';
  // Dwa meble z tym samym punktem korzystania — jedna osoba odcięłaby drugą.
  const otherPoints = new Set(others.flatMap(interactionCells).map(cellKey));
  if (interactionCells(candidate).some((cell) => otherPoints.has(cellKey(cell)))) {
    return 'collision';
  }

  const people = new Set(state.world.movement.agents.flatMap(occupiedCellKeys));
  if (cells.some((cell) => people.has(cellKey(cell)))) return 'occupiedByPerson';

  if (validateAccess(layout, [...others, candidate]).length > 0) return 'blocksAccess';
  return null;
}

// OFF-06 (Z/B): sprzedaż zwraca część ceny zakupu (zaokrąglenie w dół do całości).
export function salePrice(item: Pick<Furniture, 'type'>, config: BalanceConfig): number {
  return Math.floor(config.furniture.prices[item.type] * config.furniture.saleRefundRatio);
}

// Czy mebel jest używany: przypisane biurko albo ktoś korzysta / ma rezerwację (OFF-07).
export function furnitureUsers(state: GameState, furnitureId: FurnitureId) {
  const owner = Object.values(state.staff.employees).find((e) => e.deskId === furnitureId);
  const users = state.world.movement.agents.filter((agent) =>
    agent.reservedDestination?.startsWith(`${furnitureId}#`),
  );
  return { owner, users };
}

// OFF-07 (Z): przeniesienie lub sprzedaż przerywa korzystanie z mebla; rezerwacje są zwalniane,
// a korzystający wracają do kolejki. Odzyskana energia nie jest cofana (energia — SH-017).
// Przerwany odpoczynek z rozkazu traci minimalny czas kanapy (decyzja 3c).
export function interruptFurnitureUse(state: GameState, furnitureId: FurnitureId): GameState {
  const prefix = `${furnitureId}#`;
  const { movement } = state.world;
  const affected = movement.agents
    .filter((agent) => agent.reservedDestination?.startsWith(prefix))
    .map((agent) => agent.id);
  return {
    ...state,
    staff: withoutOrderedRest(state, affected),
    world: {
      ...state.world,
      movement: {
        ...movement,
        reservations: Object.fromEntries(
          Object.entries(movement.reservations).filter(([id]) => !id.startsWith(prefix)),
        ),
        agents: movement.agents.map((agent) =>
          agent.reservedDestination?.startsWith(prefix)
            ? {
                ...agent,
                reservedDestination: null,
                queuedSince: null,
                usedSteps: 0,
                path: [],
                status: agent.status === 'yielding' ? agent.status : 'queued',
              }
            : agent,
        ),
      },
    },
  };
}

// Sprzedaż mebla: zadania korzystania tracą jego miejsca; zadanie bez żadnego miejsca znika,
// więc postać (np. wysłana rozkazem do tego mebla) wraca do biurka zamiast czekać bez końca.
export function dropFurnitureDestinations(state: GameState, furnitureId: FurnitureId): GameState {
  const prefix = `${furnitureId}#`;
  const dropped: string[] = [];
  const agents = state.world.movement.agents.map((agent) => {
    const [task, ...rest] = agent.tasks;
    if (task?.kind !== 'use' || !task.destinationIds.some((id) => id.startsWith(prefix))) {
      return agent;
    }
    const destinationIds = task.destinationIds.filter((id) => !id.startsWith(prefix));
    if (destinationIds.length > 0)
      return { ...agent, tasks: [{ ...task, destinationIds }, ...rest] };
    dropped.push(agent.id);
    return {
      ...agent,
      tasks: rest,
      queuedSince: null,
      usedSteps: 0,
      path: [],
      status: agent.status === 'yielding' ? agent.status : ('idle' as const),
    };
  });
  return {
    ...state,
    staff: withoutOrderedRest(state, dropped),
    world: { ...state.world, movement: { ...state.world.movement, agents } },
  };
}

function withoutOrderedRest(state: GameState, ids: readonly string[]): GameState['staff'] {
  const changed = ids
    .map((id) => state.staff.employees[id as EmployeeId])
    .filter((employee): employee is Employee => !!employee && employee.orderedRest);
  if (changed.length === 0) return state.staff;
  return {
    ...state.staff,
    employees: {
      ...state.staff.employees,
      ...Object.fromEntries(changed.map((e) => [e.id, { ...e, orderedRest: false }])),
    },
  };
}

// Po zmianie mebli lub biurek każdy pracownik dostaje aktualny cel: punkt własnego biurka albo
// — bez biurka — dotychczasowe miejsce, jeśli nadal jest dozwolone (OFF-04, OFF-07).
// `only` zawęża zmianę do jednej osoby (zmiana biurka nie dotyczy pozostałych).
export function retargetEmployees(
  state: GameState,
  config: BalanceConfig,
  only?: EmployeeId,
): GameState {
  const agents = state.world.movement.agents.map((agent) => {
    const employee = state.staff.employees[agent.id as keyof typeof state.staff.employees];
    const current = agent.tasks[0];
    if (!employee || (only && employee.id !== only)) return agent;
    if (current && current.kind !== 'goTo') return agent;
    const desk = employee.deskId ? state.world.furniture[employee.deskId] : undefined;
    const deskPoint = desk ? interactionCells(desk)[0] : undefined;
    if (!deskPoint && current?.kind === 'goTo' && isFreeStandingSpot(state, current.cell)) {
      return agent;
    }
    const tasks = deskPoint
      ? [{ kind: 'goTo' as const, cell: deskPoint }]
      : tasksForEmployee(state, employee, agent.cell, config);
    if (
      current?.kind === 'goTo' &&
      tasks[0]?.kind === 'goTo' &&
      cellKey(current.cell) === cellKey(tasks[0].cell)
    ) {
      return agent;
    }
    return { ...agent, tasks, path: [] };
  });
  return { ...state, world: { ...state.world, movement: { ...state.world.movement, agents } } };
}

function isFreeStandingSpot(state: GameState, cell: GridPoint): boolean {
  if (cellKindAt(officeLayoutOf(state), cell) !== 'floor') return false;
  const furniture = Object.values(state.world.furniture);
  const blocked = new Set([
    ...furniture.flatMap(occupiedCells).map(cellKey),
    ...furniture.flatMap(interactionCells).map(cellKey),
  ]);
  return !blocked.has(cellKey(cell));
}
