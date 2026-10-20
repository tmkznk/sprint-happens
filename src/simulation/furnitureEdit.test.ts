import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { EmployeeId } from '../domain/employees';
import type { FurnitureId } from '../domain/furniture';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testState } from '../test/engineFixture';
import { interactionCells } from '../world/geometry';
import { destinationId } from '../world/movement/officeEnv';
import { createEngine } from './engine';
import { recordOperation } from './finance';
import { validatePlacement } from './furniture';

const DESK_1 = 'furniture-1' as FurnitureId;
const DESK_2 = 'furniture-2' as FurnitureId;
const SOFA = 'furniture-3' as FurnitureId;
const COFFEE = 'furniture-4' as FurnitureId;
const EMPLOYEE_1 = 'employee-1' as EmployeeId;
const EMPLOYEE_2 = 'employee-2' as EmployeeId;

function engineFor(state: GameState = testState()) {
  return createEngine({ config: DEFAULT_BALANCE, initialState: state });
}

function hire(engine: ReturnType<typeof engineFor>, count: number) {
  for (let i = 0; i < count; i++) {
    const candidate = engine.getState().staff.candidates[i];
    if (!candidate) throw new Error('brak kandydata');
    engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
  }
}

const goalOf = (state: GameState, id: string) => {
  const task = state.world.movement.agents.find((a) => a.id === id)?.tasks[0];
  return task?.kind === 'goTo' ? task.cell : null;
};

const deskPoint = (state: GameState, id: FurnitureId) => {
  const desk = state.world.furniture[id];
  return desk ? interactionCells(desk)[0] : undefined;
};

describe('AssignDesk (OFF-04)', () => {
  it('ręczna zmiana na wolne biurko przenosi cel pracownika', () => {
    const engine = engineFor();
    hire(engine, 1);

    expect(engine.dispatch({ type: 'AssignDesk', employeeId: EMPLOYEE_1, deskId: DESK_2 })).toEqual(
      {
        ok: true,
      },
    );
    const state = engine.getState();
    expect(state.staff.employees[EMPLOYEE_1]?.deskId).toBe(DESK_2);
    expect(goalOf(state, EMPLOYEE_1)).toEqual(deskPoint(state, DESK_2));
  });

  it('nie tworzy podwójnego przypisania — zajęte biurko jest odrzucane', () => {
    const engine = engineFor();
    hire(engine, 2);
    const before = engine.getState();

    expect(engine.dispatch({ type: 'AssignDesk', employeeId: EMPLOYEE_2, deskId: DESK_1 })).toEqual(
      {
        ok: false,
        rejection: { code: 'deskTaken' },
      },
    );
    expect(engine.getState()).toBe(before);
  });

  it('odebranie biurka zostawia pracownika bez stanowiska na wolnym miejscu', () => {
    const engine = engineFor();
    hire(engine, 1);
    engine.dispatch({ type: 'AssignDesk', employeeId: EMPLOYEE_1, deskId: null });

    const state = engine.getState();
    expect(state.staff.employees[EMPLOYEE_1]?.deskId).toBeNull();
    expect(goalOf(state, EMPLOYEE_1)).not.toEqual(deskPoint(state, DESK_1));
  });

  it.each([
    ['nieznany pracownik', 'employee-9', DESK_1, 'unknownEmployee'],
    ['mebel, który nie jest biurkiem', 'employee-1', SOFA, 'notADesk'],
  ] as const)('odrzuca: %s', (_, employeeId, deskId, code) => {
    const engine = engineFor();
    hire(engine, 1);

    expect(
      engine.dispatch({ type: 'AssignDesk', employeeId: employeeId as EmployeeId, deskId }),
    ).toEqual({ ok: false, rejection: { code } });
  });
});

describe('MoveFurniture (OFF-05, OFF-06, OFF-07)', () => {
  it('wymaga pauzy', () => {
    const engine = engineFor(testState({ speed: 1 }));

    expect(
      engine.dispatch({
        type: 'MoveFurniture',
        furnitureId: DESK_2,
        origin: { x: 2, y: 7 },
        rotation: 0,
      }),
    ).toEqual({ ok: false, rejection: { code: 'notPaused' } });
  });

  it('przenosi bezpłatnie, zachowuje przypisanie i kieruje właściciela do nowej pozycji', () => {
    const engine = engineFor();
    hire(engine, 1);
    const cash = engine.getState().finance.cash;

    expect(
      engine.dispatch({
        type: 'MoveFurniture',
        furnitureId: DESK_1,
        origin: { x: 2, y: 7 },
        rotation: 90,
      }),
    ).toEqual({ ok: true });
    const state = engine.getState();
    expect(state.world.furniture[DESK_1]).toMatchObject({ origin: { x: 2, y: 7 }, rotation: 90 });
    expect(state.staff.employees[EMPLOYEE_1]?.deskId).toBe(DESK_1);
    expect(state.finance.cash).toBe(cash);
    expect(goalOf(state, EMPLOYEE_1)).toEqual(deskPoint(state, DESK_1));
  });

  it('po wznowieniu właściciel dochodzi do przeniesionego biurka', () => {
    const engine = engineFor();
    hire(engine, 1);
    engine.dispatch({
      type: 'MoveFurniture',
      furnitureId: DESK_1,
      origin: { x: 2, y: 7 },
      rotation: 0,
    });
    engine.dispatch({ type: 'SetSpeed', speed: 4 });
    for (let i = 0; i < 300; i++) engine.step();

    const state = engine.getState();
    expect(state.world.movement.agents[0]).toMatchObject({
      cell: deskPoint(state, DESK_1),
      status: 'arrived',
    });
  });

  it.each([
    ['na ścianie', { x: 0, y: 5 }, 'outOfFloor'],
    ['na kanapie', { x: 13, y: 9 }, 'collision'],
    ['zastawiające drzwi do małego pokoju', { x: 8, y: 3 }, 'blocksAccess'],
    ['przez drzwi do drugiego pokoju', { x: 10, y: 6 }, 'outOfFloor'],
  ] as const)('odrzuca ustawienie %s bez zmiany stanu', (_, origin, code) => {
    const engine = engineFor();
    const before = engine.getState();

    expect(
      engine.dispatch({ type: 'MoveFurniture', furnitureId: DESK_2, origin, rotation: 0 }),
    ).toEqual({ ok: false, rejection: { code } });
    expect(engine.getState()).toBe(before);
  });

  it('nie stawia mebla na osobie stojącej lub przechodzącej przez pole', () => {
    const engine = engineFor(testState({ speed: 1 }));
    hire(engine, 1);
    for (let i = 0; i < 12; i++) engine.step();
    engine.dispatch({ type: 'SetSpeed', speed: 0 });
    const person = engine.getState().world.movement.agents[0];
    if (!person) throw new Error('brak postaci');

    expect(validatePlacement(engine.getState(), COFFEE, person.cell, 0)).toBe('occupiedByPerson');
  });
});

describe('SellFurniture (OFF-06, OFF-07, FIN-06)', () => {
  it('zwraca część ceny przez księgę; właściciel biurka traci stanowisko', () => {
    const engine = engineFor();
    hire(engine, 1);
    const cash = engine.getState().finance.cash;

    expect(engine.dispatch({ type: 'SellFurniture', furnitureId: DESK_1 })).toEqual({ ok: true });
    const state = engine.getState();
    expect(state.world.furniture[DESK_1]).toBeUndefined();
    expect(state.finance.cash).toBe(cash + 1000);
    expect(state.finance.ledger.at(-1)).toMatchObject({
      key: 'sale:furniture-1',
      kind: 'sale',
      amount: 1000,
    });
    expect(state.staff.employees[EMPLOYEE_1]?.deskId).toBeNull();
    expect(goalOf(state, EMPLOYEE_1)).not.toEqual(deskPoint(engine.getState(), DESK_1));
  });

  it('przerywa korzystanie z ekspresu i zwalnia rezerwację', () => {
    const engine = engineFor(testState({ speed: 1 }));
    hire(engine, 1);
    const state = engine.getState();
    const withCoffee = deepFreeze({
      ...state,
      world: {
        ...state.world,
        movement: {
          ...state.world.movement,
          agents: state.world.movement.agents.map((a) => ({
            ...a,
            tasks: [
              { kind: 'use' as const, destinationIds: [destinationId(COFFEE, 0)], steps: 999 },
            ],
          })),
        },
      },
    });
    const coffee = engineFor(withCoffee);
    for (let i = 0; i < 5; i++) coffee.step();
    expect(Object.keys(coffee.getState().world.movement.reservations)).toEqual([
      destinationId(COFFEE, 0),
    ]);

    coffee.dispatch({ type: 'SetSpeed', speed: 0 });
    coffee.dispatch({ type: 'SellFurniture', furnitureId: COFFEE });

    expect(coffee.getState().world.movement.reservations).toEqual({});
    expect(coffee.getState().world.movement.agents[0]?.reservedDestination).toBeNull();
  });

  it('jest dozwolona przy długu (FIN-06) i tylko raz', () => {
    const debt = recordOperation(testState(), {
      key: 'event:debt',
      kind: 'event',
      amount: -60_000,
    });
    if (!debt.ok) throw new Error('setup');
    const engine = engineFor(deepFreeze(debt.state));

    expect(engine.dispatch({ type: 'SellFurniture', furnitureId: SOFA })).toEqual({ ok: true });
    expect(engine.dispatch({ type: 'SellFurniture', furnitureId: SOFA })).toEqual({
      ok: false,
      rejection: { code: 'unknownFurniture' },
    });
  });

  it('wymaga pauzy', () => {
    const engine = engineFor(testState({ speed: 2 }));

    expect(engine.dispatch({ type: 'SellFurniture', furnitureId: SOFA })).toEqual({
      ok: false,
      rejection: { code: 'notPaused' },
    });
  });
});
