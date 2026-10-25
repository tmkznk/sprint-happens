import type { BalanceConfig } from '../domain/config';
import {
  TECH_SPECIALIZATIONS,
  type Project,
  type ReadonlyProject,
  type TechSpecialization,
} from '../domain/contracts';
import type { Employee } from '../domain/employees';
import type { GameState } from '../domain/state';
import { openBugs } from './bugs';
import { testQueue } from './qa';
import { isTechSpecialization, remainingDesign, remainingPoints } from './work';

// EMP-07 (Z): interfejs sygnalizuje, dlaczego osoba nie pracuje. Pracownik nie zmienia
// projektu samodzielnie — to wyłącznie decyzja gracza.
export type WorkStatus =
  | 'noAssignment'
  // EMP-04, OFF-07: bez biurka nie ma pracy (PM bez biurka traci premię — PROJ-11).
  | 'noDesk'
  // Projekt nie ma zakresu dla tej roli (np. Mobile przy projekcie bez aplikacji mobilnej).
  | 'noWorkForRole'
  // EMP-07 (Z): własna część ukończona — osoba pozostaje przypisana, interfejs to sygnalizuje.
  | 'scopeDone'
  // BUG-05 (Z): tester pozostaje przypisany, gdy kolejka testów jest pusta.
  | 'nothingToTest'
  | 'ready';

export function workStatus(
  state: GameState,
  employee: Employee,
  config: BalanceConfig,
): WorkStatus {
  const project = employee.projectId ? state.contracts.projects[employee.projectId] : undefined;
  if (!project || project.status !== 'active') return 'noAssignment';
  if (!employee.deskId) return 'noDesk';
  if (!hasRoleInProject(employee, project)) return 'noWorkForRole';
  const { specialization } = employee;
  // BUG-06: po ukończeniu zakresu developer naprawia wykryte błędy swojej specjalizacji.
  if (
    isTechSpecialization(specialization) &&
    remainingPoints(project, specialization) <= 0 &&
    openBugs(project, specialization, config).length === 0
  ) {
    return 'scopeDone';
  }
  // PROJ-10: Designer kończy po wykonaniu zakresu designu.
  if (specialization === 'designer' && remainingDesign(project) <= 0) return 'scopeDone';
  if (specialization === 'qa' && testQueue(project, config).length === 0) return 'nothingToTest';
  return 'ready';
}

// Czy projekt w ogóle przewiduje pracę dla tej roli.
function hasRoleInProject(employee: Employee, project: ReadonlyProject): boolean {
  switch (employee.specialization) {
    case 'frontend':
    case 'backend':
    case 'mobile':
    case 'devops':
      return project.scopes[employee.specialization] !== undefined;
    case 'designer':
      return project.designScope > 0;
    case 'qa':
    case 'pm':
      // PROJ-03, PROJ-04, PROJ-11: QA testuje wykonaną pracę, PM wspiera cały zespół.
      return true;
  }
}

export function projectTeam(state: GameState, project: Pick<Project, 'id'>): Employee[] {
  return Object.values(state.staff.employees).filter((e) => e.projectId === project.id);
}

// PROJ-02, PROJ-03 (Z): stanowiska techniczne bez obsady — zakres projektu z pracą do zrobienia,
// a w zespole nikt tej specjalizacji. QA, Designer i PM są opcjonalni (nie są „brakujący”).
// Kolejność specjalizacji jak w TECH_SPECIALIZATIONS.
export function missingRoles(
  project: ReadonlyProject,
  team: readonly Pick<Employee, 'specialization'>[],
): TechSpecialization[] {
  return TECH_SPECIALIZATIONS.filter(
    (specialization) =>
      remainingPoints(project, specialization) > 0 &&
      !team.some((member) => member.specialization === specialization),
  );
}
