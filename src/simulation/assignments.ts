import type { Project } from '../domain/contracts';
import type { Employee } from '../domain/employees';
import type { GameState } from '../domain/state';

// EMP-07 (Z): interfejs sygnalizuje, dlaczego osoba nie pracuje. Pracownik nie zmienia
// projektu samodzielnie — to wyłącznie decyzja gracza.
export type WorkStatus =
  | 'noAssignment'
  // EMP-04, OFF-07: bez biurka nie ma pracy (PM bez biurka traci premię — PROJ-11).
  | 'noDesk'
  // Projekt nie ma zakresu dla tej roli (np. Mobile przy projekcie bez aplikacji mobilnej).
  | 'noWorkForRole'
  | 'ready';

export function workStatus(state: GameState, employee: Employee): WorkStatus {
  const project = employee.projectId ? state.contracts.projects[employee.projectId] : undefined;
  if (!project || project.status !== 'active') return 'noAssignment';
  if (!employee.deskId) return 'noDesk';
  return hasRoleInProject(employee, project) ? 'ready' : 'noWorkForRole';
}

// Czy projekt w ogóle przewiduje pracę dla tej roli. Wyczerpanie zakresu w trakcie prac
// („brak własnej pracy” po ukończeniu części) dochodzi z postępem prac (SH-021).
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
