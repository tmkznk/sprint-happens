import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testState } from '../test/engineFixture';
import {
  canHire,
  canPurchase,
  forecastCash,
  recordOperation,
  registerWageDue,
  type Operation,
} from './finance';

const START = DEFAULT_BALANCE.mission.startingCash;

function apply(state: GameState, operation: Operation): GameState {
  const result = recordOperation(state, operation);
  if (!result.ok) throw new Error(result.code);
  return deepFreeze(result.state);
}

function withCash(cash: number): GameState {
  return apply(testState(), { key: 'event:setup', kind: 'event', amount: cash - START });
}

describe('recordOperation (FIN-01, FIN-02)', () => {
  it('zmienia saldo i zapisuje operację w księdze z bieżącym dniem', () => {
    const state = apply(testState({ day: 3 }), {
      key: 'advance:contract-1',
      kind: 'advance',
      amount: 4000,
      ref: 'contract-1',
    });

    expect(state.finance.cash).toBe(START + 4000);
    expect(state.finance.ledger).toEqual([
      { key: 'advance:contract-1', day: 3, kind: 'advance', amount: 4000, ref: 'contract-1' },
    ]);
  });

  it('odrzuca powtórzoną operację bez zmiany stanu (podwójna zaliczka)', () => {
    const state = apply(testState(), { key: 'advance:contract-1', kind: 'advance', amount: 4000 });

    expect(
      recordOperation(state, { key: 'advance:contract-1', kind: 'advance', amount: 4000 }),
    ).toEqual({
      ok: false,
      code: 'duplicateOperation',
    });
  });

  it('zakup wymaga pełnej dostępnej kwoty (FIN-08)', () => {
    const state = withCash(500);

    expect(recordOperation(state, { key: 'purchase:f-9', kind: 'purchase', amount: -501 })).toEqual(
      {
        ok: false,
        code: 'insufficientFunds',
      },
    );
    expect(recordOperation(state, { key: 'purchase:f-9', kind: 'purchase', amount: -500 }).ok).toBe(
      true,
    );
  });

  it('koszty obowiązkowe mogą sprowadzić saldo poniżej zera (FIN-08)', () => {
    const state = apply(withCash(100), { key: 'wages:day-1', kind: 'wages', amount: -900 });

    expect(state.finance.cash).toBe(-800);
  });

  it('odrzuca kwotę niecałkowitą', () => {
    expect(() => recordOperation(testState(), { key: 'x', kind: 'event', amount: 0.5 })).toThrow();
  });
});

describe('blokady przy długu (FIN-06)', () => {
  it('przy ujemnym saldzie nie można zatrudniać ani kupować', () => {
    const debt = withCash(-1);

    expect(canHire(debt)).toBe('inDebt');
    expect(canPurchase(debt, 0)).toBe('inDebt');
  });

  it('przy saldzie zero można zatrudnić, a zakup wymaga pokrycia ceny', () => {
    const zero = withCash(0);

    expect(canHire(zero)).toBeNull();
    expect(canPurchase(zero, 1)).toBe('insufficientFunds');
    expect(canPurchase(withCash(1), 1)).toBeNull();
  });

  it('przy długu nadal można przyjmować wpływy (zaliczki, oddania, sprzedaż)', () => {
    const debt = withCash(-1000);

    expect(recordOperation(debt, { key: 'sale:f-2', kind: 'sale', amount: 300 }).ok).toBe(true);
    expect(recordOperation(debt, { key: 'payment:c-1', kind: 'payment', amount: 5000 }).ok).toBe(
      true,
    );
  });
});

describe('prognoza salda (FIN-03, FIN-08)', () => {
  it('odejmuje dzisiejsze dniówki i utrzymanie, bez przyszłych oddań', () => {
    const state = registerWageDue(
      registerWageDue(testState(), 'employee-1', 400),
      'employee-2',
      600,
    );

    expect(forecastCash(state, DEFAULT_BALANCE)).toEqual({
      cash: START,
      wagesDue: 1000,
      upkeep: DEFAULT_BALANCE.finance.officeUpkeepPerDay,
      afterSettlement: START - 1000 - DEFAULT_BALANCE.finance.officeUpkeepPerDay,
    });
  });

  it('jedna dniówka na osobę i dzień — także przy zatrudnieniu i zwolnieniu tego samego dnia', () => {
    const hired = registerWageDue(testState(), 'employee-1', 400);
    // Zwolnienie nie usuwa należnej dniówki; ponowna rejestracja tego dnia jej nie dubluje.
    const again = registerWageDue(hired, 'employee-1', 400);

    expect(again).toBe(hired);
    expect(forecastCash(again, DEFAULT_BALANCE).wagesDue).toBe(400);
  });

  it('po rozliczeniu dnia prognoza równa się saldu (koszty są już w księdze)', () => {
    const settled = testState({
      phase: 'settled',
      timeInDayMs: 600_000,
      report: { day: 1, cashAfterSettlement: START },
    });

    expect(forecastCash(settled, DEFAULT_BALANCE).afterSettlement).toBe(START);
  });
});
