import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { GameState } from '../domain/state';
import { createPlayer } from '../test/player';
import { officeSceneText } from './officeScene';

function stateWith(
  phase: GameState['mission']['phase'],
  timeInDayMs: number,
  withEmployee = true,
): GameState {
  const player = createPlayer(DEFAULT_BALANCE, 1);
  if (withEmployee) player.hire('frontend', 'junior');
  const state = player.state();
  return { ...state, mission: { ...state.mission, phase, timeInDayMs } };
}

describe('officeSceneText (EVT-01)', () => {
  it('w trakcie dnia pracy pokazuje scenkę w widocznym oknie', () => {
    expect(officeSceneText(stateWith('working', 120_000))).not.toBeNull();
  });

  it('nie pokazuje scenki w fazie wychodzenia ani po pracy, gdy biuro jest puste', () => {
    expect(officeSceneText(stateWith('leaving', 600_000))).toBeNull();
    expect(officeSceneText(stateWith('workEnded', 600_000))).toBeNull();
  });

  it('nie pokazuje scenki bez pracowników', () => {
    expect(officeSceneText(stateWith('working', 120_000, false))).toBeNull();
  });
});
