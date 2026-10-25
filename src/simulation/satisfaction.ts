import type { BalanceConfig } from '../domain/config';
import {
  ENERGY_SCALE,
  MAX_SATISFACTION,
  SATISFACTION_SCALE,
  type Employee,
  type EmployeeId,
} from '../domain/employees';
import type { GameState } from '../domain/state';
import { activityOf } from './needs';
import { compareIds, removeEmployee } from './staff';

// NEED-03, NEED-04, NEED-05 (Z), decyzja SH-032 B3 (B): zadowolenie zmienia się wyłącznie
// w krokach symulacji (czas gry; pauza i noc go nie zmieniają — SH-004 A4c). Odejście jest
// deterministyczne: po ustalonym czasie poniżej progu ostrzeżenia, bez losowania.

export type SatisfactionRates = {
  recoveryPerStep: number;
  declinePerStep: number;
  toleranceMs: number;
  warningLevel: number;
  quitAfterMs: number;
  neutralLevel: number;
};

export function satisfactionRates(config: BalanceConfig): SatisfactionRates {
  const { satisfaction, simulation } = config;
  const perStep = (perMinute: number) =>
    Math.round((perMinute * SATISFACTION_SCALE * simulation.stepMs) / 60_000);
  return {
    recoveryPerStep: perStep(satisfaction.recoveryPerMinute),
    declinePerStep: perStep(satisfaction.declinePerMinute),
    toleranceMs: satisfaction.toleranceSeconds * 1000,
    warningLevel: satisfaction.warningThreshold * SATISFACTION_SCALE,
    quitAfterMs: satisfaction.quitAfterSeconds * 1000,
    neutralLevel: satisfaction.neutral * SATISFACTION_SCALE,
  };
}

// NEED-03: złe warunki — brak stanowiska, praca lub czekanie przy bardzo niskiej energii
// (poniżej progu wyczerpania), brak wolnego miejsca odpoczynku. Brak przydziału do projektu
// sam nie szkodzi (NEED-04).
export function hasBadConditions(
  state: GameState,
  employee: Employee,
  config: BalanceConfig,
): boolean {
  if (!employee.deskId) return true;
  const activity = activityOf(state, employee, false);
  if (activity === 'waitingForRest' || activity === 'exhausted') return true;
  const resting = activity === 'onCoffee' || activity === 'onSofa';
  return !resting && employee.energy <= config.energy.thresholds.exhausted * ENERGY_SCALE;
}

// NEED-05: ostrzeżenie widoczne w interfejsie, dopóki zadowolenie jest poniżej progu.
export function isUnhappy(employee: Employee, config: BalanceConfig): boolean {
  return employee.satisfaction < satisfactionRates(config).warningLevel;
}

export function updateSatisfaction(state: GameState, config: BalanceConfig): GameState {
  const rates = satisfactionRates(config);
  const { stepMs } = config.simulation;
  const employees = { ...state.staff.employees };
  const leaving: EmployeeId[] = [];

  for (const employee of Object.values(state.staff.employees).sort((a, b) =>
    compareIds(a.id, b.id),
  )) {
    let { satisfaction, badConditionsMs } = employee;
    if (hasBadConditions(state, employee, config)) {
      badConditionsMs += stepMs;
      if (badConditionsMs > rates.toleranceMs) {
        satisfaction = Math.max(0, satisfaction - rates.declinePerStep);
      }
    } else {
      // Dobre warunki: powolny powrót do poziomu neutralnego (z dołu i z góry).
      badConditionsMs = 0;
      satisfaction =
        satisfaction < rates.neutralLevel
          ? Math.min(rates.neutralLevel, satisfaction + rates.recoveryPerStep)
          : Math.max(rates.neutralLevel, satisfaction - rates.recoveryPerStep);
    }
    satisfaction = Math.min(MAX_SATISFACTION, satisfaction);
    const lowSatisfactionMs =
      satisfaction < rates.warningLevel ? employee.lowSatisfactionMs + stepMs : 0;
    employees[employee.id] = { ...employee, satisfaction, badConditionsMs, lowSatisfactionMs };
    if (lowSatisfactionMs >= rates.quitAfterMs) leaving.push(employee.id);
  }

  let next: GameState = { ...state, staff: { ...state.staff, employees } };
  for (const id of leaving) next = removeEmployee(next, id, 'quit', config);
  return next;
}
