import { reject, type ChooseSprintGoalCommand, type CommandHandler } from './types';

// SH-054: wybór celu sprintu (projekt aktywny albo „bez celu”) — pierwszego dnia sprintu.
export const chooseSprintGoal: CommandHandler<ChooseSprintGoalCommand> = {
  category: 'speed',
  execute(state, command) {
    const scrum = state.scrum;
    if (!scrum?.pendingGoal || !scrum.sprint) return reject('noPendingGoal');
    if (command.projectId !== null) {
      const project = state.contracts.projects[command.projectId];
      if (!project) return reject('unknownProject');
      if (project.status !== 'active') return reject('projectClosed');
    }
    return {
      ok: true,
      state: {
        ...state,
        scrum: {
          ...scrum,
          pendingGoal: false,
          sprint: { ...scrum.sprint, goalProjectId: command.projectId },
        },
      },
    };
  },
};
