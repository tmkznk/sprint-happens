import type { BalanceConfig } from '../domain/config';
import type { GameState } from '../domain/state';
import { stepMovement } from '../world/movement/movement';
import { movementEnvFor } from '../world/movement/officeEnv';
import { advanceLeaving, beginLeaving } from './commute';
import { DAY_LENGTH_MS } from './time';
import { updateNeeds } from './needs';
import { triggerEvent } from './events';
import { doTesting } from './qa';
import { updateSatisfaction } from './satisfaction';
import { doDesign, doRepairs, doWork, planWork } from './work';

// Jeden stały krok symulacji. Kolejność systemów (decyzja SH-004 B4): ruch i rezerwacje →
// czynności i potrzeby → praca/testy/naprawy → odejścia/zdarzenia → granica dnia.
// Kolejne systemy dochodzą w swoich zadaniach.
export function advanceStep(current: GameState, config: BalanceConfig): GameState {
  const { mission } = current;
  if (mission.status !== 'active' || mission.speed === 0) return current;
  // TIME-08: po 17:00 biegnie już tylko wyjście z biura (zegar dnia stoi).
  if (mission.phase === 'leaving') return advanceLeaving(current, config);
  if (mission.phase !== 'working') return current;

  // Decyzja SH-004 B4: ruch → czynności i potrzeby → praca → testy → naprawy → design. Zadania
  // developerów są planowane raz na początku fazy pracy — nikt nie pracuje podwójnie.
  const rested = updateNeeds(moveCharacters(current, config), config);
  const plan = planWork(rested, config);
  const worked = doTesting(doWork(rested, config, plan), config);
  // SH-004 B4: po pracy — zadowolenie i odejścia (zdarzenia — SH-031).
  const state = updateSatisfaction(doDesign(doRepairs(worked, config, plan), config, plan), config);

  const timeInDayMs = mission.timeInDayMs + config.simulation.stepMs;

  // TIME-08 (Z): o 17:00 praca się kończy i wszyscy wychodzą; symulacja zatrzymuje się (koniec
  // pracy, rozliczenie — SH-008), gdy biuro jest puste.
  if (timeInDayMs >= DAY_LENGTH_MS) {
    return beginLeaving({ ...state, mission: { ...state.mission, timeInDayMs: DAY_LENGTH_MS } });
  }
  // EVT-02, SH-004 B4: zdarzenie w zaplanowanej chwili dnia — po pozostałych systemach kroku.
  return triggerEvent({ ...state, mission: { ...state.mission, timeInDayMs } }, config);
}

// T:MOVE-01–09 — ruch postaci po mapie biura (SH-011, SH-012).
function moveCharacters(state: GameState, config: BalanceConfig): GameState {
  const { movement } = state.world;
  if (movement.agents.length === 0) return state;
  const next = stepMovement(movement, movementEnvFor(state, config));
  return { ...state, world: { ...state.world, movement: next } };
}
