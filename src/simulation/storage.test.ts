import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { FurnitureId } from '../domain/furniture';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testState } from '../test/engineFixture';
import { createEngine } from './engine';

// Magazyn mebli (rozdział 2, SH-050): meble po przeprowadzce czekają w magazynie; ustawienie
// z magazynu jest bezpłatne, sprzedaż zwraca część ceny jak sprzedaż mebla z biura.
function withStorage(
  storage: GameState['world']['storage'],
  patch: Partial<GameState['mission']> = {},
) {
  const state = testState(patch);
  return deepFreeze({ ...state, world: { ...state.world, storage } });
}

function engineFor(state: GameState) {
  return createEngine({ config: DEFAULT_BALANCE, initialState: state });
}

function hireOne(engine: ReturnType<typeof engineFor>) {
  const candidate = engine.getState().staff.candidates[0];
  if (!candidate) throw new Error('brak kandydata');
  expect(engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id })).toEqual({
    ok: true,
  });
}

const NEW_ID = 'furniture-5' as FurnitureId;
const DESK_PRICE = DEFAULT_BALANCE.furniture.prices.desk;

describe('PlaceFromStorage', () => {
  it('ustawia biurko bez opłaty i przydziela je pierwszej osobie bez biurka', () => {
    const engine = engineFor(withStorage({ desk: 2 }));
    hireOne(engine);
    hireOne(engine);
    hireOne(engine);
    const before = engine.getState();
    const deskless = Object.values(before.staff.employees).filter((e) => e.deskId === null);
    expect(deskless).toHaveLength(1);

    expect(
      engine.dispatch({
        type: 'PlaceFromStorage',
        furnitureType: 'desk',
        origin: { x: 8, y: 7 },
        rotation: 0,
      }),
    ).toEqual({ ok: true });
    const state = engine.getState();
    expect(state.world.furniture[NEW_ID]).toMatchObject({ type: 'desk', origin: { x: 8, y: 7 } });
    expect(state.world.storage).toEqual({ desk: 1 });
    expect(state.finance.cash).toBe(before.finance.cash);
    expect(state.finance.ledger).toEqual(before.finance.ledger);
    const [first] = deskless;
    if (!first) throw new Error('brak osoby bez biurka');
    expect(state.staff.employees[first.id]?.deskId).toBe(NEW_ID);
  });

  it('ostatnia sztuka znika z magazynu', () => {
    const engine = engineFor(withStorage({ desk: 1, plant: 1 }));
    engine.dispatch({
      type: 'PlaceFromStorage',
      furnitureType: 'plant',
      origin: { x: 12, y: 12 },
      rotation: 0,
    });
    expect(engine.getState().world.storage).toEqual({ desk: 1 });
  });

  it('brak mebla w magazynie — odmowa bez zmiany stanu', () => {
    const engine = engineFor(withStorage({ desk: 1 }));
    const before = engine.getState();
    expect(
      engine.dispatch({
        type: 'PlaceFromStorage',
        furnitureType: 'sofa',
        origin: { x: 8, y: 7 },
        rotation: 0,
      }),
    ).toEqual({ ok: false, rejection: { code: 'notInStorage' } });
    expect(engine.getState()).toBe(before);
  });

  it('niedozwolone miejsce — odmowa, magazyn bez zmian', () => {
    const engine = engineFor(withStorage({ desk: 1 }));
    const before = engine.getState();
    const result = engine.dispatch({
      type: 'PlaceFromStorage',
      furnitureType: 'desk',
      origin: { x: -1, y: 12 },
      rotation: 0,
    });
    expect(result.ok).toBe(false);
    expect(engine.getState()).toBe(before);
  });

  it('wymaga pauzy', () => {
    const engine = engineFor(withStorage({ desk: 1 }, { speed: 1 }));
    expect(
      engine.dispatch({
        type: 'PlaceFromStorage',
        furnitureType: 'desk',
        origin: { x: 8, y: 7 },
        rotation: 0,
      }),
    ).toEqual({ ok: false, rejection: { code: 'notPaused' } });
  });
});

describe('SellFromStorage', () => {
  it('zwraca część ceny przez księgę i zmniejsza licznik; dwie sprzedaże mają różne klucze', () => {
    const engine = engineFor(withStorage({ desk: 2 }));
    const cash = engine.getState().finance.cash;
    const refund = Math.round(DESK_PRICE * DEFAULT_BALANCE.furniture.saleRefundRatio);

    expect(engine.dispatch({ type: 'SellFromStorage', furnitureType: 'desk' })).toEqual({
      ok: true,
    });
    expect(engine.dispatch({ type: 'SellFromStorage', furnitureType: 'desk' })).toEqual({
      ok: true,
    });
    const state = engine.getState();
    expect(state.finance.cash).toBe(cash + 2 * refund);
    expect(state.world.storage).toEqual({});
    const sales = state.finance.ledger.filter((entry) => entry.kind === 'sale');
    expect(sales).toHaveLength(2);
    expect(new Set(sales.map((entry) => entry.key)).size).toBe(2);
  });

  it('brak mebla w magazynie — odmowa', () => {
    const engine = engineFor(withStorage({}));
    expect(engine.dispatch({ type: 'SellFromStorage', furnitureType: 'desk' })).toEqual({
      ok: false,
      rejection: { code: 'notInStorage' },
    });
  });
});
