import { projectTeam } from '../assignments';
import { reject, type AssignProjectCommand, type CommandHandler } from './types';

// EMP-05, EMP-06, PROJ-11 (Z): jeden aktywny przydział na osobę; kilku specjalistów tej samej
// roli może pracować razem; najwyżej jeden PM na projekt. Zmiana przydziału nie kasuje pracy —
// postęp należy do projektu (SH-021). Oddany projekt jest zamknięty (PROJ-07).
export const assignProject: CommandHandler<AssignProjectCommand> = {
  category: 'workDay',
  execute(state, command) {
    const employee = state.staff.employees[command.employeeId];
    if (!employee) return reject('unknownEmployee');
    if (employee.projectId === command.projectId) return { ok: true, state };
    if (command.projectId !== null) {
      const project = state.contracts.projects[command.projectId];
      if (!project) return reject('unknownProject');
      if (project.status !== 'active') return reject('projectClosed');
      if (
        employee.specialization === 'pm' &&
        projectTeam(state, project).some((member) => member.specialization === 'pm')
      ) {
        return reject('pmAlreadyAssigned');
      }
    }
    return {
      ok: true,
      state: {
        ...state,
        staff: {
          ...state.staff,
          employees: {
            ...state.staff.employees,
            [employee.id]: { ...employee, projectId: command.projectId },
          },
        },
      },
    };
  },
};
