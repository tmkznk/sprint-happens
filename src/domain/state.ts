import type { BalanceConfig } from './config';
import type { IdSequence } from './ids';
import { seedRng, type RngState } from './random';
import type { DeepReadonly } from './readonly';

// TIME-02 (Z): pauza, 1×, 2×, 4×. Zero oznacza pauzę.
export const SPEEDS = [0, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

// TIME-08 (Z): dzień pracy → koniec pracy (przegląd i oddania) → po rozliczeniu (raport).
// Przejścia między fazami realizuje SH-008.
export type DayPhase = 'working' | 'workEnded' | 'settled';

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
  };
  finance: {
    cash: number;
  };
  ids: IdSequence;
  rng: RngState;
}>;

// MIS-01 (Z): misja startuje na pauzie. Wyposażenie startowe dochodzi wraz ze światem (SH-009).
// Ziarno dostarcza warstwa aplikacji; silnik nie sięga po losowość ani czas systemowy.
export function createInitialState(config: BalanceConfig, seed: number): GameState {
  return {
    mission: { status: 'active', day: 1, phase: 'working', speed: 0, timeInDayMs: 0 },
    finance: { cash: config.mission.startingCash },
    ids: {},
    rng: seedRng(seed),
  };
}
