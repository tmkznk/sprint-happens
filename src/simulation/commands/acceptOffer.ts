import type { Project } from '../../domain/contracts';
import { allocateId } from '../../domain/ids';
import { recordOperation } from '../finance';
import { reject, type AcceptOfferCommand, type CommandHandler } from './types';

// CON-03, FIN-01, TIME-08 (Z): przyjęcie kontraktu — także bez kompletnego zespołu i przy długu
// (FIN-06). Wypłaca jedną zaliczkę (`advance:project-n`) i ustala termin na koniec dnia D+N.
// Oferta znika z tablicy; jej miejsce zostanie uzupełnione następnego dnia (CON-01).
export const acceptOffer: CommandHandler<AcceptOfferCommand> = {
  category: 'workDay',
  execute(state, command) {
    const offer = state.contracts.offers.find((o) => o.id === command.offerId);
    if (!offer) return reject('unknownOffer');

    const allocated = allocateId(state.ids, 'project');
    const project: Project = {
      ...offer,
      id: allocated.id,
      acceptedOnDay: state.mission.day,
      deadlineDay: state.mission.day + offer.deadlineDays,
      status: 'active',
    };
    const paid = recordOperation(
      { ...state, ids: allocated.sequence },
      { key: `advance:${project.id}`, kind: 'advance', amount: project.advance, ref: project.id },
    );
    if (!paid.ok) return reject(paid.code);

    return {
      ok: true,
      state: {
        ...paid.state,
        contracts: {
          ...paid.state.contracts,
          offers: paid.state.contracts.offers.filter((o) => o.id !== offer.id),
          projects: { ...paid.state.contracts.projects, [project.id]: project },
        },
      },
    };
  },
};
