import type { BalanceConfig } from '../domain/config';
import { MANDATORY_COSTS, type OperationKind } from '../domain/finance';
import type { GameState } from '../domain/state';

// Wspólne operacje finansowe (SH-027). Polecenia (zakup, zatrudnienie, kontrakt, oddanie,
// rozliczenie) korzystają wyłącznie z tych funkcji — saldo nigdy nie jest liczone w UI.

export type Operation = { key: string; kind: OperationKind; amount: number; ref?: string };

export type FinanceRejection = 'duplicateOperation' | 'insufficientFunds' | 'inDebt';

export type OperationResult =
  { ok: true; state: GameState } | { ok: false; code: FinanceRejection };

export function recordOperation(state: GameState, operation: Operation): OperationResult {
  const { finance } = state;
  if (!Number.isInteger(operation.amount)) throw new Error('Kwota operacji musi być całkowita');
  if (finance.ledger.some((entry) => entry.key === operation.key)) {
    return { ok: false, code: 'duplicateOperation' };
  }
  const cash = finance.cash + operation.amount;
  // FIN-08: dobrowolny wydatek wymaga pełnej dostępnej kwoty; koszty obowiązkowe nie.
  if (operation.amount < 0 && !MANDATORY_COSTS.has(operation.kind) && cash < 0) {
    return { ok: false, code: 'insufficientFunds' };
  }
  return {
    ok: true,
    state: {
      ...state,
      finance: {
        ...finance,
        cash,
        ledger: [
          ...finance.ledger,
          {
            key: operation.key,
            day: state.mission.day,
            kind: operation.kind,
            amount: operation.amount,
            ref: operation.ref ?? null,
          },
        ],
      },
    },
  };
}

export function isInDebt(state: GameState): boolean {
  return state.finance.cash < 0;
}

// FIN-06, FIN-08: zatrudnienie wymaga salda co najmniej zero.
export function canHire(state: GameState): FinanceRejection | null {
  return isInDebt(state) ? 'inDebt' : null;
}

// FIN-06, FIN-08: zakup wymaga pełnej kwoty i jest zablokowany przy długu.
export function canPurchase(state: GameState, price: number): FinanceRejection | null {
  if (isInDebt(state)) return 'inDebt';
  return state.finance.cash >= price ? null : 'insufficientFunds';
}

// FIN-03, FIN-08: dniówka należna za dziś — raz na osobę i dzień, także po zwolnieniu.
export function registerWageDue(state: GameState, employeeId: string, amount: number): GameState {
  if (employeeId in state.finance.wagesDueToday) return state;
  return {
    ...state,
    finance: {
      ...state.finance,
      wagesDueToday: { ...state.finance.wagesDueToday, [employeeId]: amount },
    },
  };
}

export type CashForecast = {
  cash: number;
  wagesDue: number;
  upkeep: number;
  // Saldo po dzisiejszych pensjach i utrzymaniu, bez zakładanych przyszłych oddań (FIN-08).
  afterSettlement: number;
};

export function forecastCash(state: GameState, config: BalanceConfig): CashForecast {
  const { finance, mission } = state;
  // Po rozliczeniu dnia koszty są już w księdze — prognoza to bieżące saldo.
  const pending = mission.phase !== 'settled';
  const wagesDue = pending ? Object.values(finance.wagesDueToday).reduce((a, b) => a + b, 0) : 0;
  const upkeep = pending ? config.finance.officeUpkeepPerDay : 0;
  return {
    cash: finance.cash,
    wagesDue,
    upkeep,
    afterSettlement: finance.cash - wagesDue - upkeep,
  };
}
