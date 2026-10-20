import type { Project } from '../domain/contracts';
import type { Employee } from '../domain/employees';
import type { GameState } from '../domain/state';
import { isTechSpecialization, remainingPoints } from './work';

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
  | 'ready';

export function workStatus(state: GameState, employee: Employee): WorkStatus {
  const project = employee.projectId ? state.contracts.projects[employee.projectId] : undefined;
  if (!project || project.status !== 'active') return 'noAssignment';
  if (!employee.deskId) return 'noDesk';
  if (!hasRoleInProject(employee, project)) return 'noWorkForRole';
  const { specialization } = employee;
  if (isTechSpecialization(specialization) && remainingPoints(project, specialization) <= 0) {
    return 'scopeDone';
  }
  return 'ready';
}

// Czy projekt w ogóle przewiduje pracę dla tej roli.
function hasRoleInProject(employee: Employee, project: Project): boolean {
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
