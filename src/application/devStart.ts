import type { BalanceConfig } from '../domain/config';
import { createInitialState, type GameState } from '../domain/state';
import { beginChapterTwo } from '../simulation/chapters';
import { recordOperation } from '../simulation/finance';

// Wersja deweloperska: start od razu w rozdziale 2, jak po wygranym rozdziale 1 — gotówka
// i reputacja na progach zwycięstwa rozdziału 1, meble startowe w magazynie, bez zespołu.
// Ograniczenie: bez oddanych projektów, więc tablica zleceń startuje od najmniejszych ofert.
export function chapterTwoDevState(config: BalanceConfig, seed: number): GameState {
  const base = createInitialState(config, seed);
  const won = config.mission.victory[1];
  const funded = recordOperation(base, {
    key: 'event:dev-chapter-one',
    kind: 'event',
    amount: won.cash - base.finance.cash,
  });
  if (!funded.ok) throw new Error(funded.code);
  const transition = beginChapterTwo(
    {
      ...funded.state,
      mission: {
        ...funded.state.mission,
        status: 'won',
        phase: 'settled',
        reputation: won.reputation,
      },
    },
    config,
  );
  if (!transition.ok) throw new Error(transition.code);
  return transition.state;
}
