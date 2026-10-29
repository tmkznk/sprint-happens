import type { BalanceConfig } from '../domain/config';
import type { GridPoint } from '../domain/grid';
import { createAgent } from '../domain/movement';
import type { GameState } from '../domain/state';
import { interactionCells } from '../world/geometry';
import { sameCell } from '../world/movement/grid';
import { redirectAgent, removeAgent, stepMovement } from '../world/movement/movement';
import { movementEnvFor } from '../world/movement/officeEnv';
import { officeLayoutOf } from '../world/officeLayout';
import { compareIds, spawnCell, tasksForEmployee } from './staff';

// Przejścia postaci między domem a biurem (TIME-08): wyjście po 17:00. W tych fazach biegnie
// wyłącznie ruch — bez pracy, potrzeb, zadowolenia, zdarzeń i kosztów; zegar dnia stoi.

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

// Rano biuro jest puste — postacie wracają na swoje miejsca: przy biurku albo (bez biurka) przy
// wejściu, skąd idą na wolne pole jak po zatrudnieniu. Rozwiązanie przejściowe do czasu fazy
// przyjścia (`arriving`), która zastąpi je wejściem przez drzwi przed 9:00.
export function returnToOffice(state: GameState, config: BalanceConfig): GameState {
  let current = state;
  const employees = Object.values(state.staff.employees).sort((a, b) => compareIds(a.id, b.id));
  for (const employee of employees) {
    const desk = employee.deskId ? current.world.furniture[employee.deskId] : undefined;
    const cell = (desk && interactionCells(desk)[0]) ?? spawnCell(current, config);
    if (!cell) continue;
    const agent = createAgent(employee.id, cell, tasksForEmployee(current, employee, cell, config));
    const { movement } = current.world;
    current = {
      ...current,
      world: { ...current.world, movement: { ...movement, agents: [...movement.agents, agent] } },
    };
  }
  return current;
}
