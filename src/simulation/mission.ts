import type { BalanceConfig } from '../domain/config';
import type { GameState } from '../domain/state';

// MIS-03 (Z): zwycięstwo wymaga jednocześnie liczby oddanych projektów, salda i reputacji.
// Sprawdzane wyłącznie w rozliczeniu dnia, po kosztach i kontroli bankructwa. Brak limitu dni.
export type VictoryGoals = {
  delivered: { current: number; target: number };
  cash: { current: number; target: number };
  reputation: { current: number; target: number };
};

export function victoryGoals(state: GameState, config: BalanceConfig): VictoryGoals {
  const { victory } = config.mission;
  return {
    delivered: { current: state.contracts.deliveredCount, target: victory.deliveredProjects },
    cash: { current: state.finance.cash, target: victory.cash },
    reputation: { current: state.mission.reputation, target: victory.reputation },
  };
}

export function isVictory(state: GameState, config: BalanceConfig): boolean {
  const goals = victoryGoals(state, config);
  return Object.values(goals).every((goal) => goal.current >= goal.target);
}
