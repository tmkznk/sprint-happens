import type { WageTable } from './employees';
import type { FurnitureType } from './furniture';
import { DEFAULT_MOVEMENT_CONFIG, type MovementConfig } from './movement';
import type { DeepReadonly } from './readonly';

// Konfiguracja balansu jest oddzielona od stanu misji: stan nie przechowuje jej kopii,
// a silnik otrzymuje ją przy tworzeniu (SH-006). Kwoty są liczbami całkowitymi.
export type BalanceConfig = DeepReadonly<{
  simulation: {
    // T:TIME-T01 (R): długość kroku w ms czasu gry; musi dzielić długość dnia.
    stepMs: number;
  };
  // T:MOVE-05, MOVE-09 (R): tempo ruchu i parametry rozwiązywania blokad (SH-003).
  movement: MovementConfig;
  mission: {
    // MIS-02 (B): kilka dni utrzymania małego zespołu — roboczo ustalone w SH-032.
    startingCash: number;
  };
  finance: {
    // FIN-02 (B): stałe koszty biura za dzień (SH-032).
    officeUpkeepPerDay: number;
  };
  staff: {
    // EMP-02 (B): pensja dzienna zależy od seniority (SH-032).
    dailyWage: WageTable;
  };
  contracts: {
    // CON-01 (Z): liczba ofert na tablicy.
    boardSize: number;
    // FIN-01, decyzja SH-032 B5 (B): zaliczka jako część wynagrodzenia.
    advanceRatio: number;
    // FIN-04, decyzja SH-032 B5 (B): kara za każdy rozpoczęty dzień opóźnienia.
    latePenaltyRatio: number;
    // PROJ-10, decyzja SH-032 B6 (B): punkty designu na jeden stopień znaczenia.
    designPointsPerImportance: number;
  };
  furniture: {
    // FIN-02 (B): cena zakupu wyposażenia (SH-032).
    prices: Record<FurnitureType, number>;
    // OFF-06 (B): udział ceny zakupu zwracany przy sprzedaży.
    saleRefundRatio: number;
  };
}>;

export const DEFAULT_BALANCE: BalanceConfig = {
  simulation: {
    stepMs: 100,
  },
  movement: DEFAULT_MOVEMENT_CONFIG,
  mission: {
    startingCash: 15_000,
  },
  finance: {
    officeUpkeepPerDay: 1_000,
  },
  staff: {
    dailyWage: { junior: 300, mid: 500, senior: 800 },
  },
  contracts: {
    boardSize: 3,
    advanceRatio: 0.3,
    latePenaltyRatio: 0.1,
    designPointsPerImportance: 20,
  },
  furniture: {
    prices: { desk: 2_000, sofa: 1_500, coffeeMachine: 800 },
    saleRefundRatio: 0.5,
  },
};
