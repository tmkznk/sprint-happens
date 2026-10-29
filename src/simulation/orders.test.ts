import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { ProjectId } from '../domain/contracts';
import type { Employee, EmployeeId } from '../domain/employees';
import type { Furniture, FurnitureId } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import type { GameState } from '../domain/state';
import { testState } from '../test/engineFixture';
import { interactionCells } from '../world/geometry';
import type { OrderTarget } from './commands';
import { createEngine } from './engine';
import { energyRates, isOnBreak } from './needs';
import { isAtOwnDesk, isWorking } from './work';

// Rozkazy dla postaci (sterowanie postaciami; F:OFF-04, F:NEED-02, T:ARCH-03).

type Engine = ReturnType<typeof createEngine>;
const P1 = 'project-1' as ProjectId;
const DESK_A = 'furniture-1' as FurnitureId;
const DESK_B = 'furniture-2' as FurnitureId;
const SOFA = 'furniture-3' as FurnitureId;
const COFFEE = 'furniture-4' as FurnitureId;
const NEW_DESK = 'furniture-20' as FurnitureId;
const PLANT = 'furniture-21' as FurnitureId;
const RATES = energyRates(DEFAULT_BALANCE);
const E = (value: number) => value * 1000;
const FLOOR: GridPoint = { x: 7, y: 10 };

function engineFrom(state: GameState): Engine {
  return createEngine({ config: DEFAULT_BALANCE, initialState: state });
}

// Kontrakt startowy i dwie osoby przy biurkach (furniture-1, furniture-2), gra na 1×.
function office(): { engine: Engine; a: EmployeeId; b: EmployeeId } {
  const engine = engineFrom(testState());
  const starter = engine.getState().contracts.offers[0];
  if (starter) engine.dispatch({ type: 'AcceptOffer', offerId: starter.id });
  const ids: EmployeeId[] = [];
  for (const specialization of ['frontend', 'backend'] as const) {
    const candidate = engine
      .getState()
      .staff.candidates.find((c) => c.specialization === specialization);
    if (!candidate) throw new Error('brak kandydata');
    engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
    const id = Object.values(engine.getState().staff.employees).at(-1)?.id as EmployeeId;
    engine.dispatch({ type: 'AssignProject', employeeId: id, projectId: P1 });
    ids.push(id);
  }
  engine.dispatch({ type: 'SetSpeed', speed: 1 });
  for (let i = 0; i < 400 && !ids.every((id) => atDesk(engine, id)); i++) engine.step();
  const [a, b] = ids as [EmployeeId, EmployeeId];
  expect(employee(engine, a).deskId).toBe(DESK_A);
  expect(employee(engine, b).deskId).toBe(DESK_B);
  return { engine, a, b };
}

const employee = (engine: Engine, id: EmployeeId) =>
  engine.getState().staff.employees[id] as Employee;
const atDesk = (engine: Engine, id: EmployeeId) =>
  isAtOwnDesk(engine.getState(), employee(engine, id));
const working = (engine: Engine, id: EmployeeId) =>
  isWorking(engine.getState(), employee(engine, id), DEFAULT_BALANCE);
const agentOf = (engine: Engine, id: string) =>
  engine.getState().world.movement.agents.find((a) => a.id === id);
const order = (engine: Engine, employeeId: EmployeeId, target: OrderTarget) =>
  engine.dispatch({ type: 'OrderEmployee', employeeId, target });
const toFurniture = (furnitureId: FurnitureId): OrderTarget => ({ kind: 'furniture', furnitureId });
const toCell = (cell: GridPoint): OrderTarget => ({ kind: 'cell', cell });

function patched(engine: Engine, patch: (state: GameState) => GameState): Engine {
  return engineFrom(patch(engine.getState()));
}

function withEmployee(engine: Engine, id: EmployeeId, change: Partial<Employee>): Engine {
  return patched(engine, (state) => ({
    ...state,
    staff: {
      ...state.staff,
      employees: {
        ...state.staff.employees,
        [id]: { ...(state.staff.employees[id] as Employee), ...change },
      },
    },
  }));
}

function withFurniture(engine: Engine, item: Furniture): Engine {
  return patched(engine, (state) => ({
    ...state,
    world: { ...state.world, furniture: { ...state.world.furniture, [item.id]: item } },
  }));
}

function run(engine: Engine, steps: number, onStep?: () => void) {
  for (let i = 0; i < steps; i++) {
    engine.step();
    onStep?.();
  }
}

function runUntil(engine: Engine, done: () => boolean, maxSteps = 2000) {
  for (let i = 0; i < maxSteps && !done(); i++) engine.step();
  expect(done()).toBe(true);
}

function expectRejected(engine: Engine, id: EmployeeId, target: OrderTarget, code: string) {
  const before = engine.getState();
  expect(order(engine, id, target)).toEqual({ ok: false, rejection: { code } });
  expect(engine.getState()).toBe(before);
}

describe('OrderEmployee — ekspres (NEED-02)', () => {
  it('kawa: idzie do dotkniętego ekspresu, pije, wraca do biurka; energia jak przy zwykłej kawie', () => {
    const { engine: base, a } = office();
    const engine = withEmployee(base, a, { energy: E(70) });

    expect(order(engine, a, toFurniture(COFFEE))).toEqual({ ok: true });
    expect(employee(engine, a).breakHold).toBe(true);
    expect(employee(engine, a).orderedRest).toBe(false);

    let gained = 0;
    let drank = false;
    let previous = employee(engine, a).energy;
    runUntil(engine, () => {
      const now = employee(engine, a).energy;
      if (now > previous) gained += now - previous;
      previous = now;
      if (agentOf(engine, a)?.reservedDestination === 'furniture-4#0') drank = true;
      return drank && working(engine, a);
    });
    expect(gained).toBe(RATES.coffeeGainPerStep * RATES.coffeeSteps);
    expect(atDesk(engine, a)).toBe(true);
  });

  it('zajęty ekspres: czeka w kolejce (status queued), potem pije', () => {
    const { engine, a, b } = office();
    order(engine, b, toFurniture(COFFEE));
    runUntil(engine, () => agentOf(engine, b)?.status === 'using');

    expect(order(engine, a, toFurniture(COFFEE))).toEqual({ ok: true });
    runUntil(engine, () => agentOf(engine, a)?.status === 'queued');
    expect(agentOf(engine, b)?.status).toBe('using');
    runUntil(
      engine,
      () =>
        agentOf(engine, a)?.status === 'using' &&
        agentOf(engine, a)?.reservedDestination === 'furniture-4#0',
    );
  });

  it('zepsuty ekspres → coffeeBroken', () => {
    const { engine: base, a } = office();
    const engine = patched(base, (state) => ({
      ...state,
      events: { ...state.events, coffeeBrokenDay: state.mission.day },
    }));
    expectRejected(engine, a, toFurniture(COFFEE), 'coffeeBroken');
  });
});

describe('OrderEmployee — kanapa (decyzja 3c)', () => {
  it('kanapa: odpoczywa co najmniej minOrderedSofaSteps przy pełnej energii, potem wraca', () => {
    const { engine: base, a } = office();
    const engine = withEmployee(base, a, { energy: E(100) });

    expect(order(engine, a, toFurniture(SOFA))).toEqual({ ok: true });
    expect(employee(engine, a).orderedRest).toBe(true);
    expect(agentOf(engine, a)?.tasks[0]).toMatchObject({
      kind: 'use',
      destinationIds: ['furniture-3#0', 'furniture-3#1'],
    });

    let usingSteps = 0;
    runUntil(engine, () => {
      if (agentOf(engine, a)?.status === 'using') usingSteps++;
      return usingSteps > 0 && working(engine, a);
    });
    expect(usingSteps).toBeGreaterThanOrEqual(RATES.minOrderedSofaSteps - 1);
    expect(employee(engine, a).orderedRest).toBe(false);
    expect(atDesk(engine, a)).toBe(true);
  });

  it('własne biurko z kanapy: wraca, energia odzyskana zostaje', () => {
    const { engine: base, a } = office();
    const engine = withEmployee(base, a, { energy: E(40) });
    order(engine, a, toFurniture(SOFA));
    runUntil(engine, () => (agentOf(engine, a)?.usedSteps ?? 0) >= 50);
    const recovered = employee(engine, a).energy;
    expect(recovered).toBeGreaterThan(E(40));

    expect(order(engine, a, toFurniture(DESK_A))).toEqual({ ok: true });
    expect(employee(engine, a).orderedRest).toBe(false);
    expect(engine.getState().world.movement.reservations['furniture-3#0']).toBeUndefined();
    expect(employee(engine, a).energy).toBe(recovered);
    runUntil(engine, () => working(engine, a));
    expect(isOnBreak(engine.getState(), employee(engine, a))).toBe(false);
  });

  it('przeniesienie kanapy w trakcie odpoczynku z rozkazu kasuje minimalny czas (OFF-07)', () => {
    const { engine, a } = office();
    order(engine, a, toFurniture(SOFA));
    runUntil(engine, () => agentOf(engine, a)?.status === 'using');
    engine.dispatch({ type: 'SetSpeed', speed: 0 });

    const moved = engine.dispatch({
      type: 'MoveFurniture',
      furnitureId: SOFA,
      origin: { x: 8, y: 9 },
      rotation: 0,
    });

    expect(moved).toEqual({ ok: true });
    expect(employee(engine, a).orderedRest).toBe(false);
  });

  it('sprzedaż kanapy w trakcie rozkazu: postać wraca do biurka', () => {
    const { engine, a } = office();
    order(engine, a, toFurniture(SOFA));
    runUntil(engine, () => agentOf(engine, a)?.status === 'using');
    engine.dispatch({ type: 'SetSpeed', speed: 0 });

    expect(engine.dispatch({ type: 'SellFurniture', furnitureId: SOFA })).toEqual({ ok: true });
    expect(employee(engine, a).orderedRest).toBe(false);
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    runUntil(engine, () => working(engine, a));
  });
});

describe('OrderEmployee — pole podłogi (decyzja 1c)', () => {
  it('pole: stoi na polu (arrived), nie pracuje, po 2000 krokach nadal tam', () => {
    const { engine, a } = office();
    expect(order(engine, a, toCell(FLOOR))).toEqual({ ok: true });
    expect(employee(engine, a).breakHold).toBe(true);
    runUntil(engine, () => agentOf(engine, a)?.status === 'arrived');
    const energy = employee(engine, a).energy;

    run(engine, 2000);

    expect(agentOf(engine, a)).toMatchObject({ cell: FLOOR, status: 'arrived' });
    expect(working(engine, a)).toBe(false);
    expect(employee(engine, a).energy).toBe(energy);
  });

  it('pole pod meblem / ściana / drzwi / punkt korzystania / zajęte / nieosiągalne → unreachableTarget', () => {
    const { engine: base, a, b } = office();
    // Roślina w (1,2) zamyka narożnik (1,1) między ścianami a biurkiem furniture-2.
    const engine = withFurniture(base, {
      id: PLANT,
      type: 'plant',
      origin: { x: 1, y: 2 },
      rotation: 0,
    });
    const bCell = agentOf(engine, b)?.cell as GridPoint;
    for (const cell of [
      { x: 8, y: 1 },
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 12, y: 2 },
      { x: 30, y: 30 },
      bCell,
      { x: 1, y: 1 },
    ]) {
      expectRejected(engine, a, toCell(cell), 'unreachableTarget');
    }
  });
});

describe('OrderEmployee — biurka (OFF-04)', () => {
  const newDesk: Furniture = { id: NEW_DESK, type: 'desk', origin: { x: 6, y: 11 }, rotation: 0 };

  it('wolne biurko: przypisane i postać tam pracuje; poprzednie zwolnione', () => {
    const { engine: base, a } = office();
    const engine = withFurniture(base, newDesk);

    expect(order(engine, a, toFurniture(NEW_DESK))).toEqual({ ok: true });

    const staff = Object.values(engine.getState().staff.employees);
    expect(employee(engine, a).deskId).toBe(NEW_DESK);
    expect(staff.some((e) => e.deskId === DESK_A)).toBe(false);
    runUntil(engine, () => working(engine, a));
    expect(agentOf(engine, a)?.cell).toEqual(interactionCells(newDesk)[0]);
  });

  it('przypisanie wolnego biurka nie odsyła innej postaci stojącej na polu z rozkazu', () => {
    const { engine: base, a, b } = office();
    const engine = withFurniture(base, newDesk);
    order(engine, b, toCell(FLOOR));
    runUntil(engine, () => agentOf(engine, b)?.status === 'arrived');

    order(engine, a, toFurniture(NEW_DESK));
    run(engine, 200);

    expect(agentOf(engine, b)).toMatchObject({ cell: FLOOR, status: 'arrived' });
  });

  it('cudze biurko → deskTaken', () => {
    const { engine, a } = office();
    expectRejected(engine, a, toFurniture(DESK_B), 'deskTaken');
  });
});

describe('OrderEmployee — odmowy i fazy (T:ARCH-03, TIME-08)', () => {
  it('roślina → noAction; nieznany mebel → unknownFurniture', () => {
    const { engine: base, a } = office();
    const engine = withFurniture(base, {
      id: PLANT,
      type: 'plant',
      origin: { x: 7, y: 12 },
      rotation: 0,
    });
    expectRejected(engine, a, toFurniture(PLANT), 'noAction');
    expectRejected(engine, a, toFurniture('furniture-99' as FurnitureId), 'unknownFurniture');
  });

  it('nieznany pracownik → unknownEmployee; poza biurem → employeeAway', () => {
    const { engine: base, a } = office();
    expectRejected(base, 'employee-99' as EmployeeId, toCell(FLOOR), 'unknownEmployee');
    const away = patched(base, (state) => ({
      ...state,
      world: {
        ...state.world,
        movement: {
          ...state.world.movement,
          agents: state.world.movement.agents.filter((agent) => agent.id !== a),
        },
      },
    }));
    expectRejected(away, a, toCell(FLOOR), 'employeeAway');
  });

  it('w leaving → phaseNotAllowed', () => {
    const { engine: base, a } = office();
    const engine = patched(base, (state) => ({
      ...state,
      mission: { ...state.mission, phase: 'leaving' },
    }));
    expectRejected(engine, a, toFurniture(COFFEE), 'phaseNotAllowed');
  });

  it('na pauzie przyjęte, ruch po wznowieniu', () => {
    const { engine, a } = office();
    engine.dispatch({ type: 'SetSpeed', speed: 0 });
    const cell = agentOf(engine, a)?.cell;

    expect(order(engine, a, toCell(FLOOR))).toEqual({ ok: true });
    run(engine, 50);
    expect(agentOf(engine, a)?.cell).toEqual(cell);

    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    runUntil(engine, () => agentOf(engine, a)?.status === 'arrived');
    expect(agentOf(engine, a)?.cell).toEqual(FLOOR);
  });
});

describe('OrderEmployee — po rozkazie (decyzja 2b, ostatni rozkaz wygrywa)', () => {
  it('po rozkazie zmęczona postać nie wraca na przerwę automatyczną aż do wyczerpania (breakHold)', () => {
    const { engine: base, a } = office();
    const { exhausted } = DEFAULT_BALANCE.energy.thresholds;
    // Zmęczona (poniżej progu „tired”), 2 jednostki nad wyczerpaniem.
    const engine = withEmployee(base, a, { energy: E(exhausted + 2) });
    order(engine, a, toFurniture(DESK_A));

    runUntil(
      engine,
      () => {
        const onBreak = isOnBreak(engine.getState(), employee(engine, a));
        if (onBreak) expect(employee(engine, a).energy).toBeLessThanOrEqual(E(exhausted));
        return onBreak;
      },
      E(3) / RATES.drainPerStep + 50,
    );
    expect(employee(engine, a).breakHold).toBe(false);
  });

  it('po kawie z rozkazu zmęczona postać idzie na zwykłą przerwę przy progu „tired” (2b)', () => {
    const { engine: base, a } = office();
    const { exhausted, tired } = DEFAULT_BALANCE.energy.thresholds;
    // Po kawie (+coffeeGain) energia nadal poniżej progu „tired”, ale wyraźnie nad wyczerpaniem.
    const start = tired - DEFAULT_BALANCE.energy.coffeeGain - 2;
    expect(start).toBeGreaterThan(exhausted);
    const engine = withEmployee(base, a, { energy: E(start) });
    order(engine, a, toFurniture(COFFEE));

    let drank = false;
    runUntil(engine, () => {
      const agent = agentOf(engine, a);
      if (agent?.status === 'using' && agent.reservedDestination === 'furniture-4#0') drank = true;
      return (
        drank && agent?.status !== 'using' && isOnBreak(engine.getState(), employee(engine, a))
      );
    });
    // Rozpoczęta kawa zakończyła wstrzymanie — przerwa rusza od razu, nie dopiero przy wyczerpaniu.
    expect(employee(engine, a).breakHold).toBe(false);
    expect(employee(engine, a).energy).toBeGreaterThan(E(exhausted));
  });

  it('ostatni rozkaz wygrywa: kawa, potem pole w trakcie drogi → stoi na polu', () => {
    const { engine, a } = office();
    order(engine, a, toFurniture(COFFEE));
    run(engine, 10);
    expect(agentOf(engine, a)?.reservedDestination).toBe('furniture-4#0');

    expect(order(engine, a, toCell(FLOOR))).toEqual({ ok: true });
    expect(engine.getState().world.movement.reservations['furniture-4#0']).toBeUndefined();
    let used = false;
    runUntil(engine, () => {
      if (agentOf(engine, a)?.status === 'using') used = true;
      return agentOf(engine, a)?.status === 'arrived';
    });
    expect(used).toBe(false);
    expect(agentOf(engine, a)?.cell).toEqual(FLOOR);
  });
});
