import type { BalanceConfig } from '../domain/config';
import type { GameState } from '../domain/state';
import { DAY_LENGTH_MS } from './time';

// Jeden stały krok symulacji. Kolejność systemów (T:TIME-T06, R): ruch i rezerwacje →
// czynności i potrzeby → praca/testy/poprawki → odejścia/zdarzenia → granica dnia.
// Systemy dochodzą w kolejnych zadaniach; obecnie krok przesuwa wyłącznie zegar dnia.
export function advanceStep(state: GameState, config: BalanceConfig): GameState {
  const { mission } = state;
  if (mission.status !== 'active' || mission.phase !== 'working' || mission.speed === 0) {
    return state;
  }

  const timeInDayMs = mission.timeInDayMs + config.simulation.stepMs;

  // TIME-08 (Z): po zakończeniu pracy symulacja zatrzymuje się. Rozliczenie i kolejny dzień — SH-008.
  if (timeInDayMs >= DAY_LENGTH_MS) {
    return {
      ...state,
      mission: { ...mission, timeInDayMs: DAY_LENGTH_MS, phase: 'workEnded', speed: 0 },
    };
  }
  return { ...state, mission: { ...mission, timeInDayMs } };
}
