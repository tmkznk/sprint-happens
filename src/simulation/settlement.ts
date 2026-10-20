import type { BalanceConfig } from '../domain/config';
import type { DayReport, GameState } from '../domain/state';
import { recordOperation } from './finance';

// FIN-05 (Z): trzy kolejne dni robocze na odzyskanie salda ≥ 0 po rozliczeniu z długiem.
export const RESCUE_DAYS = 3;

// TIME-08 (Z): rozliczenie dnia w ustalonej kolejności: koszty → saldo i bankructwo →
// (zwycięstwo — SH-030). Klucze operacji w księdze (`wages:day-N:…`, `upkeep:day-N`) są
// unikalne, więc dniówka i utrzymanie dnia nie mogą zostać pobrane drugi raz.
export function settle(state: GameState, config: BalanceConfig): GameState {
  const { day } = state.mission;
  let next = state;

  // FIN-03: pełna dniówka każdej osoby zatrudnionej choć przez część dnia — także zwolnionej.
  for (const [employeeId, wage] of Object.entries(state.finance.wagesDueToday)) {
    next = charge(next, { key: `wages:day-${day}:${employeeId}`, amount: -wage, ref: employeeId });
  }
  next = charge(next, { key: `upkeep:day-${day}`, amount: -config.finance.officeUpkeepPerDay });

  const cash = next.finance.cash;
  const rescueDeadlineDay = rescueDeadline(state.finance.rescueDeadlineDay, day, cash);
  // FIN-05 (decyzja SH-004 A1): liczy się wyłącznie saldo po rozliczeniu dnia.
  const bankrupt = rescueDeadlineDay !== null && cash < 0 && day >= rescueDeadlineDay;

  const report: DayReport = {
    day,
    ...dayFlows(next, day),
    cashAfterSettlement: cash,
    rescueDeadlineDay,
  };
  return {
    ...next,
    finance: { ...next.finance, wagesDueToday: {}, rescueDeadlineDay },
    mission: {
      ...next.mission,
      phase: 'settled',
      status: bankrupt ? 'bankrupt' : next.mission.status,
      report,
    },
  };
}

// Decyzja SH-004 A1: wyjście z długu kasuje licznik; ponowny dług otwiera nowy, pełny okres.
// Przykład: dług po dniu 5 → dni 6, 7, 8 → przegrana po rozliczeniu dnia 8.
export function rescueDeadline(current: number | null, day: number, cash: number): number | null {
  if (cash >= 0) return null;
  return current ?? day + RESCUE_DAYS;
}

function charge(
  state: GameState,
  operation: { key: string; amount: number; ref?: string },
): GameState {
  const kind = operation.key.startsWith('wages') ? 'wages' : 'upkeep';
  const result = recordOperation(state, { ...operation, kind });
  // Koszty obowiązkowe nie mogą zostać odrzucone za brak środków; duplikat oznaczałby błąd
  // w kolejności rozliczenia, której faza `settled` nie dopuszcza.
  if (!result.ok) throw new Error(`Nie można pobrać ${operation.key}: ${result.code}`);
  return result.state;
}

function dayFlows(state: GameState, day: number) {
  const entries = state.finance.ledger.filter((entry) => entry.day === day);
  const sum = (predicate: (entry: (typeof entries)[number]) => boolean) =>
    entries.filter(predicate).reduce((total, entry) => total + entry.amount, 0);
  // Odejmowanie od zera zamiast negacji: pusta suma daje 0, a nie -0 (JSON zapisu zmienia -0 w 0).
  return {
    income: sum((e) => e.amount > 0),
    spending: 0 - sum((e) => e.amount < 0 && e.kind !== 'wages' && e.kind !== 'upkeep'),
    wages: 0 - sum((e) => e.kind === 'wages'),
    upkeep: 0 - sum((e) => e.kind === 'upkeep'),
  };
}
