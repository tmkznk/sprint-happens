import type { DeepReadonly } from './readonly';

// Konfiguracja balansu jest oddzielona od stanu misji: stan nie przechowuje jej kopii,
// a silnik otrzymuje ją przy tworzeniu (SH-006). Kwoty są liczbami całkowitymi.
export type BalanceConfig = DeepReadonly<{
  mission: {
    // MIS-02 (B): wartość zastępcza do czasu ustalenia balansu w SH-001/SH-032.
    startingCash: number;
  };
}>;

export const DEFAULT_BALANCE: BalanceConfig = {
  mission: {
    startingCash: 50_000,
  },
};
