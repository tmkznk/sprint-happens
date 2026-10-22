import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from '../domain/config';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testState } from '../test/engineFixture';
import { createEngine } from './engine';
import { isVictory, victoryGoals } from './mission';

const { victory } = DEFAULT_BALANCE.mission;
const UPKEEP = DEFAULT_BALANCE.finance.officeUpkeepPerDay;

// Stan po pracy dnia `day` z podanym saldem, liczbą oddanych projektów i reputacją.
function endOfDay(
  cash: number,
  delivered: number,
  reputation: number,
  patch: { day?: number; rescueDeadlineDay?: number | null } = {},
): GameState {
  const state = testState({
    phase: 'workEnded',
    day: patch.day ?? 10,
    reputation,
  });
  return deepFreeze({
    ...state,
    finance: {
      ...state.finance,
      openingCash: cash,
      cash,
      rescueDeadlineDay: patch.rescueDeadlineDay ?? null,
    },
    contracts: { ...state.contracts, deliveredCount: delivered },
  });
}

function settle(state: GameState, config: BalanceConfig = DEFAULT_BALANCE) {
  const engine = createEngine({ config, initialState: state });
  expect(engine.dispatch({ type: 'SettleDay' })).toEqual({ ok: true });
  return engine;
}

describe('start misji (MIS-01, MIS-02)', () => {
  it('na pauzie, bez ludzi, z dwoma biurkami, kanapą, ekspresem i budżetem z konfiguracji', () => {
    const state = testState();
    const types = Object.values(state.world.furniture).map((f) => f.type);

    expect(state.mission).toMatchObject({ status: 'active', day: 1, phase: 'working', speed: 0 });
    expect(state.staff.employees).toEqual({});
    expect(types.filter((t) => t === 'desk')).toHaveLength(2);
    expect(types.filter((t) => t === 'sofa')).toHaveLength(1);
    expect(types.filter((t) => t === 'coffeeMachine')).toHaveLength(1);
    expect(state.finance.cash).toBe(DEFAULT_BALANCE.mission.startingCash);
  });
});

describe('zwycięstwo (MIS-03)', () => {
  it('trzy progi naraz po rozliczeniu kończą misję zwycięstwem i blokują dalsze polecenia', () => {
    const engine = settle(
      endOfDay(victory.cash + UPKEEP, victory.deliveredProjects, victory.reputation),
    );
    const state = engine.getState();

    expect(state.mission.status).toBe('won');
    expect(state.mission.report?.cashAfterSettlement).toBe(victory.cash);
    expect(engine.dispatch({ type: 'StartNextDay' })).toEqual({
      ok: false,
      rejection: { code: 'missionEnded' },
    });
    engine.step();
    expect(engine.getState()).toBe(state);
  });

  it('brak któregokolwiek progu — misja trwa', () => {
    const cash = victory.cash + UPKEEP;
    for (const state of [
      endOfDay(cash, victory.deliveredProjects - 1, victory.reputation),
      endOfDay(cash - 1, victory.deliveredProjects, victory.reputation),
      endOfDay(cash, victory.deliveredProjects, victory.reputation - 1),
    ]) {
      expect(settle(state).getState().mission.status).toBe('active');
    }
  });

  it('saldo liczy się po dzisiejszych kosztach', () => {
    const before = endOfDay(victory.cash, victory.deliveredProjects, victory.reputation);
    expect(isVictory(before, DEFAULT_BALANCE)).toBe(true);
    expect(settle(before).getState().mission.status).toBe('active');
  });

  it('bankructwo ma pierwszeństwo przed zwycięstwem', () => {
    // Konfiguracja, w której oba warunki zachodzą jednocześnie.
    const config = {
      ...DEFAULT_BALANCE,
      mission: { ...DEFAULT_BALANCE.mission, victory: { ...victory, cash: -1_000_000 } },
    };
    const state = endOfDay(-500, victory.deliveredProjects, victory.reputation, {
      day: 8,
      rescueDeadlineDay: 8,
    });
    expect(settle(state, config).getState().mission.status).toBe('bankrupt');
  });

  it('brak limitu dni', () => {
    const state = endOfDay(20_000, 0, 50, { day: 400 });
    const engine = settle(state);
    expect(engine.getState().mission.status).toBe('active');
    expect(engine.dispatch({ type: 'StartNextDay' })).toEqual({ ok: true });
  });

  it('cele pokazują bieżące wartości i progi z konfiguracji', () => {
    expect(victoryGoals(endOfDay(1234, 2, 55), DEFAULT_BALANCE)).toEqual({
      delivered: { current: 2, target: victory.deliveredProjects },
      cash: { current: 1234, target: victory.cash },
      reputation: { current: 55, target: victory.reputation },
    });
  });
});
