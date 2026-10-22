import { isReadyForDelivery, paymentPreview } from '../delivery';
import { recordOperation } from '../finance';
import { applyReputation, rateProject } from '../quality';
import { reject, type CommandHandler, type DeliverProjectCommand } from './types';

// PROJ-06, PROJ-07, FIN-04, BUG-04 (Z): ręczne oddanie projektu — jedno rozliczenie pieniędzy,
// jakości i reputacji, po którym projekt jest zamknięty (bez reklamacji). Dozwolone także po
// zakończeniu pracy, przed rozliczeniem dnia — wtedy w dniu terminu jest terminowe.
// Decyzja SH-004 A2: wszyscy przypisani tracą przydział (PM — premię), zachowują biurka.
export const deliverProject: CommandHandler<DeliverProjectCommand> = {
  category: 'delivery',
  execute(state, command, config) {
    const project = state.contracts.projects[command.projectId];
    if (!project) return reject('unknownProject');
    if (project.status !== 'active') return reject('projectClosed');
    if (!isReadyForDelivery(project)) return reject('projectIncomplete');

    const { day } = state.mission;
    const money = paymentPreview(project, day);
    // Klucz `payment:project-n` chroni przed podwójną wypłatą (FIN-07).
    const paid = recordOperation(state, {
      key: `payment:${project.id}`,
      kind: 'payment',
      amount: money.payment,
      ref: project.id,
    });
    if (!paid.ok) return reject(paid.code);

    const rating = rateProject(project, day, config);
    const reputation = applyReputation(state.mission.reputation, rating.reputation.total);
    const employees = Object.fromEntries(
      Object.entries(paid.state.staff.employees).map(([id, employee]) => [
        id,
        employee.projectId === project.id ? { ...employee, projectId: null } : employee,
      ]),
    );

    return {
      ok: true,
      state: {
        ...paid.state,
        mission: { ...paid.state.mission, reputation },
        staff: { ...paid.state.staff, employees },
        contracts: {
          ...paid.state.contracts,
          deliveredCount: paid.state.contracts.deliveredCount + 1,
          projects: {
            ...paid.state.contracts.projects,
            [project.id]: {
              ...project,
              status: 'delivered',
              delivery: {
                day,
                daysLate: money.daysLate,
                penalty: money.penalty,
                payment: money.payment,
                remainingBugs: rating.remainingBugs,
                qualityPermille: rating.qualityPermille,
                designPermille: rating.designPermille,
                reputation: rating.reputation,
                reputationAfter: reputation,
              },
            },
          },
        },
      },
    };
  },
};
