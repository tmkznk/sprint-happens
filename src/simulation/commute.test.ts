import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { ProjectId } from '../domain/contracts';
import type { EmployeeId, Seniority, Specialization } from '../domain/employees';
import type { FurnitureId } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import { createAgent } from '../domain/movement';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { runUntilPhase, testState } from '../test/engineFixture';
import { createPlayer } from '../test/player';
import { interactionCells } from '../world/geometry';
import { neighbours, sameCell } from '../world/movement/grid';
import { destinationId } from '../world/movement/officeEnv';
import { cellKindAt, OFFICE_LAYOUT, PROLOGUE_LAYOUT } from '../world/officeLayout';
import { entryCell, maxTransitSteps } from './commute';
import { createEngine, type Engine } from './engine';
import { compareIds } from './staff';
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

// Po rozliczeniu dnia: trzech pracowników przy projekcie. Biurka startowe są dwa — trzecie
// dokupione, chyba że trzeci ma zostać bez biurka.
function settledWithStaff(withoutDesk = false): GameState {
  const player = createPlayer();
  const project = player.acceptStarter();
  if (!withoutDesk) player.buyDesk();
  const ids = [
    player.hire('frontend', 'junior'),
    player.hire('backend', 'junior'),
    player.hire('frontend', 'mid'),
  ];
  for (const id of ids) player.assign(id, project);
  expect(Object.values(player.state().staff.employees).filter((e) => !e.deskId)).toHaveLength(
    withoutDesk ? 1 : 0,
  );
  if (!player.runUntil((s) => s.mission.phase === 'workEnded')) throw new Error('brak końca dnia');
  player.must({ type: 'SettleDay' });
  return player.state();
}

function morning(state: GameState = settledWithStaff()): Engine {
  const engine = engineFrom(state);
  expect(engine.dispatch({ type: 'StartNextDay' })).toEqual({ ok: true });
  return engine;
}

const MISSION_ENTRY = { x: 1, y: 10 };

function onCell(agent: GameState['world']['movement']['agents'][number], cell: GridPoint) {
  return sameCell(agent.cell, cell) || (agent.move !== null && sameCell(agent.move.to, cell));
}

describe('przyjście przed 9:00 (TIME-04, TIME-05, OFF-04)', () => {
  it('pole wejścia: jedyne pole podłogi przy drzwiach wejściowych', () => {
    expect(entryCell(OFFICE_LAYOUT)).toEqual(MISSION_ENTRY);
    expect(entryCell(PROLOGUE_LAYOUT)).toEqual({ x: 1, y: 4 });
  });

  it.each([
    ['OFFICE_LAYOUT', OFFICE_LAYOUT],
    ['PROLOGUE_LAYOUT', PROLOGUE_LAYOUT],
  ])('%s: wejście ma dokładnie jedno sąsiednie pole podłogi', (_name, layout) => {
    const door = layout.doors.find((d) => d.isEntrance)?.position;
    expect(door).toBeDefined();
    const floor = neighbours(door as GridPoint).filter((c) => cellKindAt(layout, c) === 'floor');
    expect(floor).toHaveLength(1);
    expect(entryCell(layout)).toEqual(floor[0]);
  });

  it('StartNextDay zaczyna dzień w arriving z kolejką w kolejności ID', () => {
    const engine = morning();
    const { mission, staff, world } = engine.getState();
    expect(mission).toMatchObject({ phase: 'arriving', timeInDayMs: 0, transitSteps: 0, speed: 0 });
    const ids = Object.keys(staff.employees).sort(compareIds);
    expect(ids).toHaveLength(3);
    expect(staff.entryQueue).toEqual(ids);
    expect(world.movement.agents).toEqual([]);
    expect(world.movement.reservations).toEqual({});
  });

  it('postacie wchodzą pojedynczo przez entryCell', () => {
    const engine = morning();
    const order = [...engine.getState().staff.entryQueue];
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    const appeared: string[] = [];
    while (engine.getState().mission.phase === 'arriving') {
      engine.step();
      const { agents } = engine.getState().world.movement;
      expect(agents.filter((a) => onCell(a, MISSION_ENTRY)).length).toBeLessThanOrEqual(1);
      const newcomers = agents.filter((a) => !appeared.includes(a.id));
      // Najwyżej jedna nowa postać na krok — pojawia się na polu wejścia.
      expect(newcomers.length).toBeLessThanOrEqual(1);
      for (const agent of newcomers) {
        expect(sameCell(agent.cell, MISSION_ENTRY)).toBe(true);
        appeared.push(agent.id);
      }
    }
    expect(appeared).toEqual(order);
  });

  it('po dojściu wszystkich: working, zegar 9:00 (timeInDayMs 0), każdy w punkcie swojego biurka', () => {
    const engine = morning();
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    let steps = 0;
    while (engine.getState().mission.phase === 'arriving') {
      engine.step();
      steps++;
    }
    const state = engine.getState();
    expect(state.mission).toMatchObject({
      phase: 'working',
      timeInDayMs: 0,
      transitSteps: 0,
      speed: 1,
    });
    expect(state.staff.entryQueue).toEqual([]);
    expect(steps).toBeLessThan(maxTransitSteps(DEFAULT_BALANCE));
    for (const employee of Object.values(state.staff.employees)) {
      expect(isAtOwnDesk(state, employee)).toBe(true);
    }
  });

  it('w arriving nie ma pracy, energii, zadowolenia ani zdarzenia', () => {
    const engine = morning();
    const start = engine.getState();
    // Zdarzenie dnia uzbrojone na samą 9:00 — mimo to nie wyzwala się przed working.
    const armed = engineFrom({ ...start, events: { ...start.events, scheduledAtMs: 0 } });
    armed.dispatch({ type: 'SetSpeed', speed: 1 });
    const before = armed.getState();
    while (armed.getState().mission.phase === 'arriving') {
      armed.step();
      expect(armed.getState().events.pending).toBeNull();
    }
    const after = armed.getState();
    expect(after.contracts).toEqual(before.contracts);
    expect(after.staff.employees).toEqual(before.staff.employees);
    expect(after.staff.candidates).toEqual(before.staff.candidates);
    expect(after.finance).toEqual(before.finance);
    expect(after.events).toEqual(before.events);
    expect(after.rng).toEqual(before.rng);
    expect(after.mission.timeInDayMs).toBe(0);
  });

  it('pracownik bez biurka staje na wolnym polu i nie blokuje przejścia do working', () => {
    const engine = morning(settledWithStaff(true));
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    let steps = 0;
    while (engine.getState().mission.phase === 'arriving') {
      engine.step();
      steps++;
    }
    const state = engine.getState();
    expect(state.mission.phase).toBe('working');
    expect(steps).toBeLessThan(maxTransitSteps(DEFAULT_BALANCE));
    const deskless = Object.values(state.staff.employees).find((e) => e.deskId === null);
    const agent = state.world.movement.agents.find((a) => a.id === deskless?.id);
    expect(agent).toMatchObject({ move: null, status: 'arrived' });
    expect(agent && sameCell(agent.cell, MISSION_ENTRY)).toBe(false);
    expect(OFFICE_LAYOUT.doors.some((d) => agent && sameCell(d.position, agent.cell))).toBe(false);
    for (const employee of Object.values(state.staff.employees)) {
      if (employee.deskId) expect(isAtOwnDesk(state, employee)).toBe(true);
    }
  });

  it('bezpiecznik: zajęte entryCell → po limicie wszyscy na celach, working', () => {
    const settled = settledWithStaff(true);
    // Roślina na polu wejścia — nikt nie może wejść.
    const blocked: GameState = {
      ...settled,
      world: {
        ...settled.world,
        furniture: {
          ...settled.world.furniture,
          ['furniture-99' as FurnitureId]: {
            id: 'furniture-99' as FurnitureId,
            type: 'plant',
            origin: MISSION_ENTRY,
            rotation: 0,
          },
        },
      },
    };
    const engine = morning(blocked);
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    const limit = maxTransitSteps(DEFAULT_BALANCE);
    for (let i = 0; i < limit - 1; i++) engine.step();
    expect(engine.getState().mission.phase).toBe('arriving');
    expect(engine.getState().staff.entryQueue).toHaveLength(3);

    engine.step();
    const state = engine.getState();
    expect(state.mission).toMatchObject({ phase: 'working', transitSteps: 0, timeInDayMs: 0 });
    expect(state.staff.entryQueue).toEqual([]);
    expect(state.world.movement.agents.map((a) => a.id).sort(compareIds)).toEqual(
      Object.keys(state.staff.employees).sort(compareIds),
    );
    for (const employee of Object.values(state.staff.employees)) {
      if (employee.deskId) expect(isAtOwnDesk(state, employee)).toBe(true);
    }
    const deskless = state.world.movement.agents.find(
      (a) => state.staff.employees[a.id as EmployeeId]?.deskId === null,
    );
    expect(deskless && sameCell(deskless.cell, MISSION_ENTRY)).toBe(false);
  });

  it('bezpiecznik: biurko zajęte przez inną postać → pracownik staje na wolnym polu', () => {
    const engine = morning();
    const start = engine.getState();
    const [first, second] = start.staff.entryQueue as [EmployeeId, EmployeeId, EmployeeId];
    const desk = start.world.furniture[start.staff.employees[second]?.deskId as FurnitureId];
    if (!desk) throw new Error('brak biurka');
    const deskPoint = interactionCells(desk)[0] as GridPoint;
    // Pierwszy stoi (bez celu) w punkcie biurka drugiego; pole wejścia zablokowane — kolejka stoi.
    const stuck: GameState = {
      ...start,
      mission: { ...start.mission, transitSteps: maxTransitSteps(DEFAULT_BALANCE) - 1, speed: 1 },
      staff: { ...start.staff, entryQueue: start.staff.entryQueue.filter((id) => id !== first) },
      world: {
        ...start.world,
        movement: { ...start.world.movement, agents: [createAgent(first, deskPoint)] },
        furniture: {
          ...start.world.furniture,
          ['furniture-99' as FurnitureId]: {
            id: 'furniture-99' as FurnitureId,
            type: 'plant',
            origin: MISSION_ENTRY,
            rotation: 0,
          },
        },
      },
    };
    const late = engineFrom(stuck);
    late.step();
    const state = late.getState();
    expect(state.mission.phase).toBe('working');
    const agents = state.world.movement.agents;
    expect(agents).toHaveLength(3);
    const cells = new Set(agents.map((a) => `${a.cell.x},${a.cell.y}`));
    expect(cells.size).toBe(3);
    const placed = agents.find((a) => a.id === second);
    expect(placed && sameCell(placed.cell, deskPoint)).toBe(false);
  });

  it('pełny dzień: working → leaving → workEnded → SettleDay → StartNextDay → arriving → working', () => {
    const run = (speed: 1 | 4) => {
      const engine = morning();
      const phases: string[] = [engine.getState().mission.phase];
      const note = () => {
        const { phase } = engine.getState().mission;
        if (phases.at(-1) !== phase) phases.push(phase);
      };
      engine.dispatch({ type: 'SetSpeed', speed });
      for (const target of ['working', 'leaving', 'workEnded'] as const) {
        while (engine.getState().mission.phase !== target) {
          engine.step();
          note();
        }
      }
      expect(engine.dispatch({ type: 'SettleDay' })).toEqual({ ok: true });
      note();
      expect(engine.dispatch({ type: 'StartNextDay' })).toEqual({ ok: true });
      note();
      engine.dispatch({ type: 'SetSpeed', speed });
      runUntilPhase(engine, 'working');
      note();
      const state = engine.getState();
      return { phases, state: { ...state, mission: { ...state.mission, speed: 0 } } };
    };
    const slow = run(1);
    const fast = run(4);
    expect(slow.phases).toEqual([
      'arriving',
      'working',
      'leaving',
      'workEnded',
      'settled',
      'arriving',
      'working',
    ]);
    expect(fast.state).toEqual(slow.state);
  });
});
