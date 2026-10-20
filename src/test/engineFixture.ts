import { DEFAULT_BALANCE, type BalanceConfig } from '../domain/config';
import { createInitialState, type GameState } from '../domain/state';
import { createEngine } from '../simulation/engine';
import { deepFreeze } from './deepFreeze';

export const TEST_SEED = 12345;

export function testState(missionPatch: Partial<GameState['mission']> = {}): GameState {
  const initial = createInitialState(DEFAULT_BALANCE, TEST_SEED);
  return deepFreeze({ ...initial, mission: { ...initial.mission, ...missionPatch } });
}

export function testEngine(
  missionPatch: Partial<GameState['mission']> = {},
  config: BalanceConfig = DEFAULT_BALANCE,
) {
  return createEngine({ config, initialState: testState(missionPatch) });
}
