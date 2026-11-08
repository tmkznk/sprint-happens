import { expect } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from '../domain/config';
import type { GameState } from '../domain/state';
import { deepFreeze } from './deepFreeze';
import { createPlayer } from './player';

// Rozdział 1 wygrany po pierwszym rozliczeniu (progi zerowe), z aktywnym projektem w toku,
// trzema osobami (jedna bez przydziału) i dokupionym biurkiem.
const EASY: BalanceConfig = {
  ...DEFAULT_BALANCE,
  mission: {
    ...DEFAULT_BALANCE.mission,
    victory: {
      ...DEFAULT_BALANCE.mission.victory,
      1: { deliveredProjects: 0, cash: 0, reputation: 0 },
    },
  },
};

export function wonChapterOne(): GameState {
  const player = createPlayer(EASY);
  const project = player.acceptStarter();
  player.assign(player.hire('frontend', 'mid'), project);
  player.assign(player.hire('backend', 'junior'), project);
  player.hire('qa', 'mid');
  player.buyDesk();
  player.finishDay();
  const state = player.state();
  expect(state.mission.status).toBe('won');
  return deepFreeze(state);
}
