import { TECH_SPECIALIZATIONS, type ReadonlyProject } from '../domain/contracts';
import { daysLate } from './quality';
import { remainingPoints } from './work';

// PROJ-06 (Z): oddanie wymaga ukończenia wszystkich części technicznych (także wdrożenia —
// zakresu DevOps). Nie wymaga QA, Designera, PM-a ani naprawienia błędów.
export function isReadyForDelivery(project: ReadonlyProject): boolean {
  return TECH_SPECIALIZATIONS.every((s) => remainingPoints(project, s) <= 0);
}

export type PaymentPreview = { daysLate: number; penalty: number; payment: number };

// FIN-01, FIN-04 (Z): reszta wynagrodzenia minus kara za każdy rozpoczęty dzień opóźnienia,
// najwyżej do zera; zaliczka pozostaje. Błędy nie pomniejszają wypłaty (BUG-04).
// Panel pokazuje to potrącenie na bieżąco, bez ujawniania jakości (BUG-03).
export function paymentPreview(project: ReadonlyProject, day: number): PaymentPreview {
  const late = daysLate(project, day);
  const remainder = project.reward - project.advance;
  const penalty = Math.min(remainder, late * project.latePenaltyPerDay);
  return { daysLate: late, penalty, payment: remainder - penalty };
}
