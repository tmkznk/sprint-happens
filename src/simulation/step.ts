import type { BalanceConfig } from '../domain/config';
import type { GameState } from '../domain/state';
import { stepMovement } from '../world/movement/movement';
import { movementEnvFor } from '../world/movement/officeEnv';
import { DAY_LENGTH_MS } from './time';
import { updateNeeds } from './needs';
import { doTesting } from './qa';
import { updateSatisfaction } from './satisfaction';
import { doDesign, doRepairs, doWork, planWork } from './work';

// Jeden stały krok symulacji. Kolejność systemów (decyzja SH-004 B4): ruch i rezerwacje →
// czynności i potrzeby → praca/testy/naprawy → odejścia/zdarzenia → granica dnia.
// Kolejne systemy dochodzą w swoich zadaniach.
export function advanceStep(current: GameState, config: BalanceConfig): GameState {
  const { mission } = current;
  if (mission.status !== 'active' || mission.phase !== 'working' || mission.speed === 0) {
    return current;
  }

  // Decyzja SH-004 B4: ruch → czynności i potrzeby → praca → testy → naprawy → design. Zadania
  // developerów są planowane raz na początku fazy pracy — nikt nie pracuje podwójnie.
  const rested = updateNeeds(moveCharacters(current, config), config);
  const plan = planWork(rested, config);
  const worked = doTesting(doWork(rested, config, plan), config);
  // SH-004 B4: po pracy — zadowolenie i odejścia (zdarzenia — SH-031).
  const state = updateSatisfaction(doDesign(doRepairs(worked, config, plan), config, plan), config);

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
