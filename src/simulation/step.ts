import type { BalanceConfig } from '../domain/config';
import type { GameState } from '../domain/state';
import { stepMovement } from '../world/movement/movement';
import { movementEnvFor } from '../world/movement/officeEnv';
import { DAY_LENGTH_MS } from './time';
import { doWork } from './work';

// Jeden stały krok symulacji. Kolejność systemów (decyzja SH-004 B4): ruch i rezerwacje →
// czynności i potrzeby → praca/testy/naprawy → odejścia/zdarzenia → granica dnia.
// Kolejne systemy dochodzą w swoich zadaniach.
export function advanceStep(current: GameState, config: BalanceConfig): GameState {
  const { mission } = current;
  if (mission.status !== 'active' || mission.phase !== 'working' || mission.speed === 0) {
    return current;
  }

  // Decyzja SH-004 B4: ruch → (czynności i potrzeby — SH-017) → praca.
  const state = doWork(moveCharacters(current, config), config);

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

// T:MOVE-01–09 — ruch postaci po mapie biura (SH-011, SH-012).
function moveCharacters(state: GameState, config: BalanceConfig): GameState {
  const { movement } = state.world;
  if (movement.agents.length === 0) return state;
  const next = stepMovement(movement, movementEnvFor(state, config));
  return { ...state, world: { ...state.world, movement: next } };
}
