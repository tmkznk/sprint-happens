import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { ProjectId } from '../domain/contracts';
import type { EmployeeId, Seniority, Specialization } from '../domain/employees';
import type { FurnitureId } from '../domain/furniture';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { runUntilPhase, testState } from '../test/engineFixture';
import { destinationId } from '../world/movement/officeEnv';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import { maxTransitSteps } from './commute';
import { createEngine, type Engine } from './engine';
import { DAY_LENGTH_MS } from './time';
import { isAtOwnDesk } from './work';

const P1 = 'project-1' as ProjectId;
const SOFA = 'furniture-3' as FurnitureId;
const SOFA_SEAT = destinationId(SOFA, 0);
const STEP_MS = DEFAULT_BALANCE.simulation.stepMs;
const ENTRANCE = OFFICE_LAYOUT.doors.find((door) => door.isEntrance)?.position;

function engineFrom(state: GameState): Engine {
  return createEngine({ config: DEFAULT_BALANCE, initialState: deepFreeze(state) });
}

const ROLES: [Specialization, Seniority][] = [
  ['frontend', 'junior'],
  ['backend', 'junior'],
  ['frontend', 'mid'],
];

// Dwóch pracowników przy biurkach (przydział do projektu startowego), trzeci — bez biurka —
// na kanapie z rezerwacją siedziska. Ostatni krok dnia pracy przed 17:00, gra na 1×.
function lastStepOfDay(): GameState {
  const engine = engineFrom(testState());
  const starter = engine.getState().contracts.offers[0];
  if (starter) engine.dispatch({ type: 'AcceptOffer', offerId: starter.id });
  const ids: EmployeeId[] = [];
  for (const [specialization, seniority] of ROLES) {
    const candidate = engine
      .getState()
      .staff.candidates.find(
        (c) => c.specialization === specialization && c.seniority === seniority,
      );
    if (!candidate) throw new Error('brak kandydata');
    engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
    const id = Object.values(engine.getState().staff.employees).at(-1)?.id as EmployeeId;
    engine.dispatch({ type: 'AssignProject', employeeId: id, projectId: P1 });
    ids.push(id);
  }
  const [first, second, resting] = ids as [EmployeeId, EmployeeId, EmployeeId];
  engine.dispatch({ type: 'SetSpeed', speed: 1 });
  const seated = () =>
    [first, second].every((id) => {
      const employee = engine.getState().staff.employees[id];
      return !!employee && isAtOwnDesk(engine.getState(), employee);
    });
  for (let i = 0; i < 400 && !seated(); i++) engine.step();
  if (!seated()) throw new Error('pracownicy nie doszli do biurek');

  // Trzeci idzie na kanapę (zmęczony — odpoczynek trwa do końca dnia).
  const before = engine.getState();
  const tired = engineFrom({
    ...before,
    staff: {
      ...before.staff,
      employees: {
        ...before.staff.employees,
        [resting]: { ...before.staff.employees[resting], energy: 0 },
      } as GameState['staff']['employees'],
    },
    world: {
      ...before.world,
      movement: {
        ...before.world.movement,
        agents: before.world.movement.agents.map((a) =>
          a.id === resting
            ? {
                ...a,
                tasks: [{ kind: 'use', destinationIds: [SOFA_SEAT], steps: 1_000_000 }, ...a.tasks],
                path: [],
              }
            : a,
        ),
      },
    },
  });
  const onSofa = () =>
    tired.getState().world.movement.agents.find((a) => a.id === resting)?.status === 'using';
  for (let i = 0; i < 400 && !onSofa(); i++) tired.step();
  if (!onSofa()) throw new Error('trzeci pracownik nie usiadł na kanapie');

  const state = tired.getState();
  return {
    ...state,
    mission: { ...state.mission, timeInDayMs: DAY_LENGTH_MS - STEP_MS },
  };
}

describe('wyjście z biura po pracy (TIME-08, SH-004 B4)', () => {
  it('o 17:00 dzień przechodzi w leaving, a nie workEnded', () => {
    const engine = engineFrom(lastStepOfDay());
    engine.step();

    const { mission, world } = engine.getState();
    expect(mission).toMatchObject({
      phase: 'leaving',
      timeInDayMs: DAY_LENGTH_MS,
      transitSteps: 0,
      speed: 1,
    });
    expect(world.movement.agents).toHaveLength(3);
    for (const agent of world.movement.agents) {
      expect(agent.tasks).toEqual([{ kind: 'goTo', cell: ENTRANCE }]);
    }
  });

  it('w leaving wszyscy idą do drzwi i znikają; potem workEnded na pauzie', () => {
    const engine = engineFrom(lastStepOfDay());
    let steps = 0;
    const counted: Engine = {
      ...engine,
      step() {
        steps++;
        engine.step();
      },
    };
    runUntilPhase(counted, 'workEnded');

    const { mission, world } = engine.getState();
    expect(mission).toMatchObject({
      phase: 'workEnded',
      speed: 0,
      transitSteps: 0,
      timeInDayMs: DAY_LENGTH_MS,
    });
    expect(world.movement.agents).toEqual([]);
    expect(world.movement.reservations).toEqual({});
    // Wszyscy doszli do drzwi przed bezpiecznikiem.
    expect(steps).toBeLessThan(maxTransitSteps(DEFAULT_BALANCE) + 1);
  });

  it('w leaving nie ma pracy, energii ani zadowolenia', () => {
    const engine = engineFrom(lastStepOfDay());
    engine.step();
    const atFive = engine.getState();
    runUntilPhase(engine, 'workEnded');
    const after = engine.getState();

    expect(after.contracts).toEqual(atFive.contracts);
    expect(after.staff).toEqual(atFive.staff);
    expect(after.finance).toEqual(atFive.finance);
    expect(after.events).toEqual(atFive.events);
    expect(after.rng).toEqual(atFive.rng);
  });

  it('rezerwacja kanapy zwolniona na początku leaving', () => {
    const state = lastStepOfDay();
    expect(state.world.movement.reservations[SOFA_SEAT]).toBeDefined();

    const engine = engineFrom(state);
    engine.step();

    const { movement } = engine.getState().world;
    expect(movement.reservations[SOFA_SEAT]).toBeUndefined();
    expect(movement.agents.every((a) => a.reservedDestination === null)).toBe(true);
  });

  it('bezpiecznik: zablokowana droga do drzwi → workEnded po maxTransitSteps', () => {
    const state = lastStepOfDay();
    // Roślina na jedynym polu za drzwiami wejściowymi odcina wyjście wszystkim.
    const blocked: GameState = {
      ...state,
      world: {
        ...state.world,
        furniture: {
          ...state.world.furniture,
          ['furniture-99' as FurnitureId]: {
            id: 'furniture-99' as FurnitureId,
            type: 'plant',
            origin: { x: 1, y: 10 },
            rotation: 0,
          },
        },
      },
    };
    const engine = engineFrom(blocked);
    const limit = maxTransitSteps(DEFAULT_BALANCE);
    for (let i = 0; i < limit; i++) engine.step();
    expect(engine.getState().mission.phase).toBe('leaving');
    expect(engine.getState().world.movement.agents).toHaveLength(3);

    engine.step();
    const { mission, world } = engine.getState();
    expect(mission).toMatchObject({ phase: 'workEnded', speed: 0, transitSteps: 0 });
    expect(world.movement.agents).toEqual([]);
    expect(world.movement.reservations).toEqual({});
  });

  it('limit przejścia w krokach wynika z konfiguracji', () => {
    expect(maxTransitSteps(DEFAULT_BALANCE)).toBe(600);
    expect(
      maxTransitSteps({
        ...DEFAULT_BALANCE,
        simulation: { stepMs: 200, maxTransitSeconds: 30 },
      }),
    ).toBe(150);
  });

  it('ten sam przebieg przy tempie 1× i 4×', () => {
    const state = lastStepOfDay();
    const slow = engineFrom(state);
    const fast = engineFrom(state);
    fast.dispatch({ type: 'SetSpeed', speed: 4 });

    runUntilPhase(slow, 'workEnded');
    runUntilPhase(fast, 'workEnded');

    expect(fast.getState()).toEqual(slow.getState());
  });
});
