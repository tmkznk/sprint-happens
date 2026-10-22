import type { BalanceConfig } from '../domain/config';
import { POINT_SCALE, TECH_SPECIALIZATIONS, type ReadonlyProject } from '../domain/contracts';
import { remainingBugCount } from './bugs';

// REP-01–04, BUG-04, PROJ-10 (Z), formuły SH-032 B7 (B): jawne składniki oceny oddanego projektu.
// Raport rozdziela terminowość, jakość techniczną i design (pieniądze liczy oddanie — SH-026).

export type ProjectRating = {
  daysLate: number;
  // Wszystkie nienaprawione błędy — ukryte i wykryte jednakowo (BUG-04).
  remainingBugs: number;
  // Jakość techniczna w promilach: 1000 — bez błędów, 0 — gęstość ≥ progu.
  qualityPermille: number;
  // Ukończenie designu w promilach; 0 przy braku zakresu designu.
  designPermille: number;
  reputation: { punctuality: number; quality: number; design: number; total: number };
};

// FIN-04 (Z): rozpoczęte dni opóźnienia — przy terminie D oddanie w D+1 to jeden dzień.
// Oddanie w dniu D (także po pracy, przed rozliczeniem) jest terminowe.
export function daysLate(project: ReadonlyProject, day: number): number {
  return Math.max(0, day - project.deadlineDay);
}

export function technicalScopePoints(project: ReadonlyProject): number {
  return TECH_SPECIALIZATIONS.reduce((sum, s) => sum + (project.scopes[s] ?? 0), 0);
}

// BUG-04: gęstość błędów względem całego zakresu technicznego (większy projekt znosi więcej).
export function qualityPermille(project: ReadonlyProject, config: BalanceConfig): number {
  const scope = technicalScopePoints(project);
  if (scope === 0) return 1000;
  const bugs = remainingBugCount(project, config);
  const loss = Math.round((bugs * 100 * 1000) / (scope * config.reputation.bugsPer100ForZero));
  return Math.max(0, 1000 - loss);
}

// PROJ-10: częściowy design daje proporcjonalną część premii.
export function designPermille(project: ReadonlyProject): number {
  if (project.designScope === 0) return 0;
  return Math.floor((project.designProgress * 1000) / (project.designScope * POINT_SCALE));
}

export function rateProject(
  project: ReadonlyProject,
  day: number,
  config: BalanceConfig,
): ProjectRating {
  const { reputation } = config;
  const late = daysLate(project, day);
  const quality = qualityPermille(project, config);
  const design = designPermille(project);
  const punctuality = late === 0 ? reputation.onTimeBonus : -reputation.latePenaltyPerDay * late;
  const qualityPoints = Math.round(
    (reputation.qualityWeight * (quality - reputation.qualityPivot * 1000)) / 1000,
  );
  // REP-04: brak designu = brak premii, nie kara.
  const designPoints = Math.round((project.designImportance * design) / 1000);
  return {
    daysLate: late,
    remainingBugs: remainingBugCount(project, config),
    qualityPermille: quality,
    designPermille: design,
    reputation: {
      punctuality,
      quality: qualityPoints,
      design: designPoints,
      total: punctuality + qualityPoints + designPoints,
    },
  };
}

// REP-01 (Z): reputacja zawsze w zakresie 0–100.
export function applyReputation(current: number, change: number): number {
  return Math.min(100, Math.max(0, current + change));
}
