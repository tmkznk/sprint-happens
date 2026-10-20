import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testState } from '../test/engineFixture';
import { createEngine } from './engine';
import { recordOperation, registerWageDue } from './finance';
import { rescueDeadline } from './settlement';
import { DAY_LENGTH_MS } from './time';

const UPKEEP = DEFAULT_BALANCE.finance.officeUpkeepPerDay;

function engineFor(state: GameState) {
  return createEngine({ config: DEFAULT_BALANCE, initialState: deepFreeze(state) });
}

// Przenosi dzień do końca pracy i rozlicza; `cashTarget` ustawia saldo przed rozliczeniem tak,
// aby po pobraniu kosztów wyniosło dokładnie tyle (zdarzenie w księdze).
function settleDayWithCash(state: GameState, cashAfter: number): GameState {
  const costs = UPKEEP + Object.values(state.finance.wagesDueToday).reduce((a, b) => a + b, 0);
  const adjusted = recordOperation(state, {
    key: `event:test-day-${state.mission.day}`,
    kind: 'event',
    amount: cashAfter + costs - state.finance.cash,
  });
  if (!adjusted.ok) throw new Error(adjusted.code);
  const engine = engineFor({
    ...adjusted.state,
    mission: {
      ...adjusted.state.mission,
      phase: 'workEnded',
      speed: 0,
      timeInDayMs: DAY_LENGTH_MS,
    },
  });
  expect(engine.dispatch({ type: 'SettleDay' })).toEqual({ ok: true });
  return engine.getState();
}

function nextDay(state: GameState): GameState {
  const engine = engineFor(state);
  expect(engine.dispatch({ type: 'StartNextDay' })).toEqual({ ok: true });
  return engine.getState();
}

describe('rozliczenie dnia — koszty (FIN-02, FIN-03)', () => {
  it('pobiera dniówki i utrzymanie raz, czyści należności i zapisuje raport', () => {
    let state = registerWageDue(testState({ day: 2 }), 'employee-1', 300);
    state = registerWageDue(state, 'employee-2', 800);
    const engine = engineFor({
      ...state,
      mission: { ...state.mission, phase: 'workEnded', timeInDayMs: DAY_LENGTH_MS },
    });

    engine.dispatch({ type: 'SettleDay' });

    const after = engine.getState();
    expect(after.finance.cash).toBe(state.finance.cash - 1100 - UPKEEP);
    expect(after.finance.ledger.map((e) => e.key)).toEqual([
      'wages:day-2:employee-1',
      'wages:day-2:employee-2',
      'upkeep:day-2',
    ]);
    expect(after.finance.wagesDueToday).toEqual({});
    expect(after.mission.report).toMatchObject({ day: 2, wages: 1100, upkeep: UPKEEP });
    expect(engine.dispatch({ type: 'SettleDay' }).ok).toBe(false);
  });

  it('osoba zatrudniona i zwolniona tego samego dnia dostaje jedną dniówkę, a kolejnego dnia żadnej', () => {
    // Zwolnionej osoby nie ma już w zespole, ale jej dniówka za dziś pozostaje należna.
    const state = registerWageDue(testState(), 'employee-9', 500);
    const settled = settleDayWithCash(state, 10_000);
    expect(settled.finance.ledger.filter((e) => e.ref === 'employee-9')).toHaveLength(1);

    const day2 = nextDay(settled);
    expect(day2.finance.wagesDueToday).toEqual({});
  });

  it('raport rozdziela wpływy, wydatki, pensje i utrzymanie dnia', () => {
    let state = testState();
    for (const operation of [
      { key: 'sale:furniture-3', kind: 'sale', amount: 750 },
      { key: 'purchase:furniture-9', kind: 'purchase', amount: -800 },
    ] as const) {
      const result = recordOperation(state, operation);
      if (!result.ok) throw new Error(result.code);
      state = result.state;
    }
    const engine = engineFor({
      ...registerWageDue(state, 'employee-1', 300),
      mission: { ...state.mission, phase: 'workEnded', timeInDayMs: DAY_LENGTH_MS },
    });
    engine.dispatch({ type: 'SettleDay' });

    expect(engine.getState().mission.report).toMatchObject({
      income: 750,
      spending: 800,
      wages: 300,
      upkeep: UPKEEP,
    });
  });
});

describe('okres ratunkowy i bankructwo (FIN-05, FIN-07, decyzja SH-004 A1)', () => {
  // Przechodzi dni od `fromDay`, ustawiając saldo po kolejnych rozliczeniach.
  function play(cashAfterEachDay: number[], fromDay = 5): GameState[] {
    let state = testState({ day: fromDay });
    const settled: GameState[] = [];
    for (const cash of cashAfterEachDay) {
      state = settleDayWithCash(state, cash);
      settled.push(state);
      if (state.mission.status !== 'active') break;
      state = nextDay(state);
    }
    return settled;
  }

  it('dług po dniu 5 → dni ratunkowe 6, 7, 8 → przegrana po rozliczeniu dnia 8', () => {
    const days = play([-100, -100, -100, -100]);

    expect(days.map((s) => s.finance.rescueDeadlineDay)).toEqual([8, 8, 8, 8]);
    expect(days.map((s) => s.mission.status)).toEqual(['active', 'active', 'active', 'bankrupt']);
    expect(days.at(-1)?.mission.day).toBe(8);
  });

  it('wyjście z długu kasuje licznik, a ponowny dług otwiera nowy pełny okres', () => {
    // Dzień 5 dług, 6 dług, 7 na plusie, 8–9 na plusie, 10 dług → termin 13.
    const days = play([-100, -100, 50, 50, 50, -100, -100, -100, -100]);

    expect(days.map((s) => [s.mission.day, s.finance.rescueDeadlineDay])).toEqual([
      [5, 8],
      [6, 8],
      [7, null],
      [8, null],
      [9, null],
      [10, 13],
      [11, 13],
      [12, 13],
      [13, 13],
    ]);
    expect(days.at(-1)?.mission.status).toBe('bankrupt');
  });

  it('liczy się wyłącznie saldo po rozliczeniu — chwilowa poprawa w ciągu dnia nic nie zmienia', () => {
    const [day5] = play([-100], 5);
    if (!day5) throw new Error('brak dnia');
    let day6 = nextDay(day5);
    const income = recordOperation(day6, { key: 'payment:x', kind: 'payment', amount: 10_000 });
    if (!income.ok) throw new Error(income.code);
    day6 = income.state;
    expect(day6.finance.rescueDeadlineDay).toBe(8);

    expect(settleDayWithCash(day6, -1).finance.rescueDeadlineDay).toBe(8);
  });

  it('saldo dokładnie zero nie jest długiem', () => {
    expect(rescueDeadline(null, 5, 0)).toBeNull();
    expect(rescueDeadline(8, 7, 0)).toBeNull();
    expect(rescueDeadline(null, 5, -1)).toBe(8);
  });

  it('po bankructwie nie ma następnego dnia', () => {
    const bankrupt = play([-1, -1, -1, -1]).at(-1);
    if (!bankrupt) throw new Error('brak stanu');

    expect(engineFor(bankrupt).dispatch({ type: 'StartNextDay' })).toEqual({
      ok: false,
      rejection: { code: 'missionEnded' },
    });
  });
});
