import type { BalanceConfig } from './config';
import type { Finance } from './finance';
import type { Furniture, FurnitureId } from './furniture';
import { allocateId, type IdSequence } from './ids';
import { STARTING_FURNITURE } from './missionStart';
import { createMovementState, type MovementState } from './movement';
import { seedRng, type RngState } from './random';
import type { DeepReadonly } from './readonly';

// TIME-02 (Z): pauza, 1×, 2×, 4×. Zero oznacza pauzę.
export const SPEEDS = [0, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

// TIME-08 (Z): dzień pracy → koniec pracy (przegląd i oddania) → po rozliczeniu (raport).
export type DayPhase = 'working' | 'workEnded' | 'settled';

// TIME-03 (Z): podsumowanie dnia. Koszty, przychody i terminy dochodzą w SH-029.
export type DayReport = {
  day: number;
  cashAfterSettlement: number;
};

// MIS-03 (Z): zwycięstwo i bankructwo kończą misję.
export type MissionStatus = 'active' | 'won' | 'bankrupt';

export type GameState = DeepReadonly<{
  mission: {
    status: MissionStatus;
    day: number;
    phase: DayPhase;
    speed: Speed;
    // Upływ bieżącego dnia w ms czasu gry; rośnie wyłącznie o pełne kroki symulacji.
    timeInDayMs: number;
    // Raport rozliczenia bieżącego dnia; w stanie, aby przetrwał zapis (SAVE-T04).
    report: DayReport | null;
  };
  finance: Finance;
  world: {
    furniture: Record<FurnitureId, Furniture>;
    // T:MOVE-03–09: pozycje, przejścia, trasy, kolejki i rezerwacje postaci (SAVE-T02).
    movement: MovementState;
  };
  ids: IdSequence;
  rng: RngState;
}>;

// MIS-01 (Z): misja startuje na pauzie, bez pracowników, ze startowym wyposażeniem.
// Ziarno dostarcza warstwa aplikacji; silnik nie sięga po losowość ani czas systemowy.
export function createInitialState(config: BalanceConfig, seed: number): GameState {
  let ids: IdSequence = {};
  const furniture: Record<FurnitureId, Furniture> = {};
  for (const placement of STARTING_FURNITURE) {
    const allocated = allocateId(ids, 'furniture');
    ids = allocated.sequence;
    furniture[allocated.id] = { ...placement, id: allocated.id };
  }

  return {
    mission: {
      status: 'active',
      day: 1,
      phase: 'working',
      speed: 0,
      timeInDayMs: 0,
      report: null,
    },
    finance: {
      openingCash: config.mission.startingCash,
      cash: config.mission.startingCash,
      ledger: [],
      wagesDueToday: {},
    },
    world: { furniture, movement: createMovementState([]) },
    ids,
    rng: seedRng(seed),
  };
}
