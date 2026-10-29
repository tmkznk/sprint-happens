import type { BalanceConfig } from '../domain/config';
import { MAX_ENERGY, ENERGY_SCALE, type Employee } from '../domain/employees';
import type { Furniture, FurnitureId } from '../domain/furniture';
import type { ReadonlyAgent } from '../domain/movement';
import type { GameState } from '../domain/state';
import { interactionCells } from '../world/geometry';
import { finishUse } from '../world/movement/movement';
import { destinationId } from '../world/movement/officeEnv';
import { isCoffeeBroken } from './events';

// NEED-01, NEED-02 (Z), decyzje SH-004 A3/A4 i SH-032 B2: energia, przerwy, kawa i kanapa.
// System działa w kroku po ruchu i przed pracą (SH-004 B4). Stan logiczny czynności wynika
// wyłącznie z danych silnika — animacja niczego nie kończy (T:VIEW-01).

export type Activity =
  | 'idle'
  // TIME-04: poza biurem (czeka przed wejściem albo już wyszedł) — brak agenta ruchu.
  | 'away'
  | 'walking'
  | 'working'
  // NEED-02: czeka na wolne miejsce odpoczynku — bez regeneracji i bez zużycia energii.
  | 'waitingForRest'
  | 'onCoffee'
  | 'onSofa'
  // NEED-01, NEED-02: energia 0 i brak jakiegokolwiek miejsca odpoczynku.
  | 'exhausted';

type RestKind = 'coffee' | 'sofa';

export type EnergyRates = {
  drainPerStep: number;
  coffeeGainPerStep: number;
  coffeeSteps: number;
  sofaGainPerStep: number;
  maxRestSteps: number;
};

export function energyRates(config: BalanceConfig): EnergyRates {
  const { energy, simulation } = config;
  const stepsPerSecond = 1000 / simulation.stepMs;
  const coffeeSteps = Math.round(energy.coffeeSeconds * stepsPerSecond);
  return {
    drainPerStep: Math.round((energy.drainPerSecond * ENERGY_SCALE) / stepsPerSecond),
    coffeeGainPerStep: Math.round((energy.coffeeGain * ENERGY_SCALE) / coffeeSteps),
    coffeeSteps,
    sofaGainPerStep: Math.round((energy.sofaGainPerSecond * ENERGY_SCALE) / stepsPerSecond),
    maxRestSteps: Math.round(energy.maxRestSeconds * stepsPerSecond),
  };
}

// Zadanie korzystania z miejsc odpoczynku ma długi limit; koniec przerwy wyznacza ten system.
const OPEN_ENDED_USE = 1_000_000;

function restDestinations(state: GameState, kind: RestKind): string[] {
  const type: Furniture['type'] = kind === 'coffee' ? 'coffeeMachine' : 'sofa';
  // Zdarzenie „Ekspres strajkuje”: do końca dnia nikt nie wybiera kawy.
  if (kind === 'coffee' && isCoffeeBroken(state)) return [];
  return Object.values(state.world.furniture)
    .filter((item) => item.type === type)
    .flatMap((item) => interactionCells(item).map((_, index) => destinationId(item.id, index)));
}

function restKindOf(state: GameState, destination: string | null): RestKind | null {
  if (!destination) return null;
  const furnitureId = destination.split('#')[0] as FurnitureId;
  const type = state.world.furniture[furnitureId]?.type;
  return type === 'coffeeMachine' ? 'coffee' : type === 'sofa' ? 'sofa' : null;
}

function isRestTask(state: GameState, agent: ReadonlyAgent): boolean {
  const task = agent.tasks[0];
  return task?.kind === 'use' && task.destinationIds.some((id) => restKindOf(state, id) !== null);
}

// Wolne miejsce: bez rezerwacji i bez nikogo w kolejce po nie.
function freeDestinations(state: GameState, ids: string[]): string[] {
  const { reservations, agents } = state.world.movement;
  const queued = new Set(
    agents.flatMap((agent) => {
      const task = agent.tasks[0];
      return agent.reservedDestination === null && task?.kind === 'use' ? task.destinationIds : [];
    }),
  );
  return ids.filter((id) => !reservations[id] && !queued.has(id));
}

function queueLength(state: GameState, ids: string[]): number {
  return state.world.movement.agents.filter((agent) => {
    const task = agent.tasks[0];
    return (
      agent.reservedDestination === null &&
      task?.kind === 'use' &&
      task.destinationIds.some((id) => ids.includes(id))
    );
  }).length;
}

// SH-004 A4a: dobór przerwy według progów energii. Zwraca miejsca do zadania „use” albo null.
export function chooseRest(
  state: GameState,
  employee: Employee,
  config: BalanceConfig,
): string[] | null {
  const { thresholds, shortQueue } = config.energy;
  const energy = employee.energy / ENERGY_SCALE;
  const coffee = restDestinations(state, 'coffee');
  const sofa = restDestinations(state, 'sofa');
  const freeCoffee = freeDestinations(state, coffee);
  const freeSofa = freeDestinations(state, sofa);

  if (energy <= thresholds.exhausted) {
    // NEED-02: przy bardzo niskiej energii kanapa; gdy zajęta — kawa; gdy oba zajęte — kolejka.
    if (freeSofa.length > 0) return sofa;
    if (freeCoffee.length > 0) return coffee;
    return sofa.length + coffee.length > 0 ? [...sofa, ...coffee] : null;
  }
  if (energy <= thresholds.tired) {
    if (coffee.length > 0 && (freeCoffee.length > 0 || queueLength(state, coffee) < shortQueue)) {
      return coffee;
    }
    if (freeSofa.length > 0) return sofa;
    return sofa.length + coffee.length > 0 ? [...coffee, ...sofa] : null;
  }
  // Przerwa profilaktyczna: tylko wolny ekspres bez kolejki; bez kanapy (SH-004 A4a).
  if (energy <= thresholds.prophylactic && freeCoffee.length > 0) return coffee;
  return null;
}

export function isOnBreak(state: GameState, employee: Employee): boolean {
  const agent = state.world.movement.agents.find((a) => a.id === employee.id);
  return !!agent && isRestTask(state, agent);
}

export function updateNeeds(state: GameState, config: BalanceConfig): GameState {
  const rates = energyRates(config);
  const { rested } = config.energy.thresholds;
  let movement = state.world.movement;
  const employees = { ...state.staff.employees };

  for (const agent of state.world.movement.agents) {
    const employee = employees[agent.id as keyof typeof employees];
    if (!employee) continue;

    // Regeneracja w trakcie korzystania; przerwanie zachowuje to, co już odzyskano (SH-004 A3).
    const kind = agent.status === 'using' ? restKindOf(state, agent.reservedDestination) : null;
    if (kind) {
      const gain = kind === 'coffee' ? rates.coffeeGainPerStep : rates.sofaGainPerStep;
      const energy = Math.min(MAX_ENERGY, employee.energy + gain);
      employees[employee.id] = { ...employee, energy };
      const finished =
        kind === 'coffee'
          ? agent.usedSteps >= rates.coffeeSteps
          : energy >= rested * ENERGY_SCALE || agent.usedSteps >= rates.maxRestSteps;
      if (finished) movement = finishUse(movement, agent.id);
      continue;
    }

    // Decyzja o przerwie tylko u osoby, która pracuje przy biurku (energia spada wyłącznie przy pracy).
    if (isRestTask(state, agent) || agent.tasks[0]?.kind !== 'goTo' || agent.status !== 'arrived') {
      continue;
    }
    // Kolejne decyzje w tym samym kroku widzą rezerwacje i kolejki już podjęte (jeden ekspres
    // nie może przyciągnąć na „wolną” kawę dwóch osób naraz).
    const current = { ...state, world: { ...state.world, movement } };
    const rest = chooseRest(current, employee, config);
    if (!rest) continue;
    movement = {
      ...movement,
      agents: movement.agents.map((a) =>
        a.id === agent.id
          ? {
              ...a,
              tasks: [{ kind: 'use', destinationIds: rest, steps: OPEN_ENDED_USE }, ...a.tasks],
              path: [],
            }
          : a,
      ),
    };
  }

  return {
    ...state,
    staff: { ...state.staff, employees },
    world: { ...state.world, movement },
  };
}

// NEED-01 (Z): energia maleje podczas pracy (wywoływane przez system pracy dla pracujących).
export function drainEnergy(employee: Employee, config: BalanceConfig): Employee {
  return { ...employee, energy: Math.max(0, employee.energy - energyRates(config).drainPerStep) };
}

// SH-032 B2: wydajność × (0,5 + 0,5 × energia); przy zerowej energii praca stoi (NEED-01).
export function energyFactor(employee: Employee): number {
  return employee.energy <= 0 ? 0 : 0.5 + (0.5 * employee.energy) / MAX_ENERGY;
}

export function activityOf(state: GameState, employee: Employee, working: boolean): Activity {
  const agent = state.world.movement.agents.find((a) => a.id === employee.id);
  if (!agent) return 'away';
  if (working) return 'working';
  if (agent.status === 'using') {
    return restKindOf(state, agent.reservedDestination) === 'sofa' ? 'onSofa' : 'onCoffee';
  }
  if (isRestTask(state, agent)) return agent.reservedDestination ? 'walking' : 'waitingForRest';
  if (employee.energy <= 0) return 'exhausted';
  return agent.move ? 'walking' : 'idle';
}
