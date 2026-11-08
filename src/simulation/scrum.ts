import type { BalanceConfig } from '../domain/config';
import type { ProjectId } from '../domain/contracts';
import { MAX_SATISFACTION, SATISFACTION_SCALE, type Employee } from '../domain/employees';
import type { GameState } from '../domain/state';
import { applyReputation } from './quality';
import { activeEffect, scrumActive } from './retro';

// Rozdział 2 — Scrum (SH-053–SH-056).

export function isScrumMaster(employee: Pick<Employee, 'specialization'>): boolean {
  return employee.specialization === 'scrumMaster';
}

// SH-053: jeden Scrum Master na firmę.
export function scrumMasterOf(state: GameState): Employee | null {
  return Object.values(state.staff.employees).find(isScrumMaster) ?? null;
}

// SH-054: Scrum działa, gdy firma ma Scrum Mastera z biurkiem i stół konferencyjny w biurze.
export function scrumReady(state: GameState): boolean {
  if (state.mission.chapter !== 2 || !state.scrum) return false;
  const sm = scrumMasterOf(state);
  return (
    !!sm?.deskId &&
    Object.values(state.world.furniture).some((item) => item.type === 'conferenceTable')
  );
}

// Początek dnia (po „Następny dzień”): koniec sprintu z rozliczeniem celu, przerwanie sprintu
// bez Scrum Mastera albo stołu i start nowego sprintu dzień po spełnieniu warunków.
export function beginScrumDay(state: GameState, config: BalanceConfig): GameState {
  const { scrum } = state;
  if (!scrum) return state;
  const day = state.mission.day;
  let next: GameState = {
    ...state,
    staff: { ...state.staff, employees: withDailySatisfaction(state) },
    scrum: { ...scrum, meeting: null, pendingGoal: false },
  };
  const sprint = scrum.sprint;
  if (sprint && day > sprint.endDay) {
    next = settleSprintGoal(next, config, false);
    next = { ...next, scrum: next.scrum && { ...next.scrum, sprint: null } };
  } else if (sprint && !scrumActive(next)) {
    // Utrata Scrum Mastera albo stołu przerywa sprint — bez retro i bez rozliczenia celu.
    next = { ...next, scrum: next.scrum && { ...next.scrum, sprint: null, pendingRetro: null } };
  }
  const current = next.scrum;
  if (current && !current.sprint && scrumReady(next)) {
    const number = current.sprintsStarted + 1;
    next = {
      ...next,
      scrum: {
        ...current,
        sprintsStarted: number,
        sprint: {
          number,
          startDay: day,
          endDay: day + config.scrum.sprintDays - 1,
          goalProjectId: null,
          goalSettled: false,
        },
        pendingGoal: true,
      },
    };
  }
  return next;
}

// Rozliczenie celu sprintu dokładnie raz: oddany cel — premia, koniec sprintu bez oddania — kara.
// Bez celu albo po rozliczeniu nic się nie dzieje.
export function settleSprintGoal(
  state: GameState,
  config: BalanceConfig,
  delivered: boolean,
): GameState {
  const sprint = state.scrum?.sprint;
  if (!state.scrum || !sprint || sprint.goalProjectId === null || sprint.goalSettled) return state;
  const effect = delivered ? config.scrum.goalSuccess : config.scrum.goalFailure;
  const employees = Object.fromEntries(
    Object.entries(state.staff.employees).map(([id, employee]) => [
      id,
      {
        ...employee,
        satisfaction: Math.min(
          MAX_SATISFACTION,
          Math.max(0, employee.satisfaction + effect.satisfaction * SATISFACTION_SCALE),
        ),
      },
    ]),
  ) as GameState['staff']['employees'];
  return {
    ...state,
    mission: {
      ...state.mission,
      reputation: applyReputation(state.mission.reputation, effect.reputation),
    },
    staff: { ...state.staff, employees },
    scrum: { ...state.scrum, sprint: { ...sprint, goalSettled: true } },
  };
}

// Premia celu sprintu (‰) dla pracy nad projektem-celem.
export function goalBonusPermille(
  state: GameState,
  projectId: ProjectId,
  config: BalanceConfig,
): number {
  const sprint = state.scrum?.sprint;
  return sprint && sprint.goalProjectId === projectId && !sprint.goalSettled
    ? config.scrum.goalBonusPermille
    : 0;
}

// Decyzja gracza zatrzymuje grę: o 9:00 (koniec przyjścia) przy oczekującym celu albo retro.
export function scrumDecisionPending(state: GameState): boolean {
  return !!state.scrum && (state.scrum.pendingGoal || state.scrum.pendingRetro !== null);
}

// SH-056: karty retro — zmiana zadowolenia zespołu na początku każdego dnia.
function withDailySatisfaction(state: GameState): GameState['staff']['employees'] {
  const points = activeEffect(state).satisfactionPerDay;
  if (points === 0) return state.staff.employees;
  return Object.fromEntries(
    Object.entries(state.staff.employees).map(([id, employee]) => [
      id,
      {
        ...employee,
        satisfaction: Math.min(
          MAX_SATISFACTION,
          Math.max(0, employee.satisfaction + points * SATISFACTION_SCALE),
        ),
      },
    ]),
  ) as GameState['staff']['employees'];
}
