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
    // MIS-02 (B): wartość zastępcza do czasu ustalenia balansu w SH-001/SH-032.
    startingCash: number;
  };
  finance: {
    // FIN-02 (B): stałe koszty biura za dzień; wartość zastępcza do SH-032.
    officeUpkeepPerDay: number;
  };
}>;

export const DEFAULT_BALANCE: BalanceConfig = {
  simulation: {
    stepMs: 100,
  },
  movement: DEFAULT_MOVEMENT_CONFIG,
  mission: {
    startingCash: 50_000,
  },
  finance: {
    officeUpkeepPerDay: 1_000,
  },
};
