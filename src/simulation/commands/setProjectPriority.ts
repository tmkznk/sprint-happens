import { PROJECT_PRIORITIES } from '../../domain/contracts';
import { reject, type CommandHandler, type SetProjectPriorityCommand } from './types';

// PROJ-05 (Z): priorytet działa per projekt na własną specjalizację developerów; zmiana nie kasuje
// postępu funkcji ani napraw (postęp należy do projektu i do błędu). Oddany projekt jest zamknięty.
export const setProjectPriority: CommandHandler<SetProjectPriorityCommand> = {
  category: 'workDay',
  execute(state, command) {
    const project = state.contracts.projects[command.projectId];
    if (!project) return reject('unknownProject');
    if (project.status !== 'active') return reject('projectClosed');
    if (!PROJECT_PRIORITIES.includes(command.priority)) return reject('invalidPriority');
    if (project.priority === command.priority) return { ok: true, state };
    return {
      ok: true,
      state: {
        ...state,
        contracts: {
          ...state.contracts,
          projects: {
            ...state.contracts.projects,
            [project.id]: { ...project, priority: command.priority },
          },
        },
      },
    };
  },
};
