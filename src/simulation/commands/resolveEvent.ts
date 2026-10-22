import { applyEffects, eventTemplate } from '../events';
import { reject, type CommandHandler, type ResolveEventCommand } from './types';

// EVT-02 (Z): wybór odpowiedzi na zdarzenie — skutki dokładnie raz, potem przywrócenie tempa
// sprzed automatycznej pauzy (jawna reguła wznowienia). Oczekująca decyzja przetrwała zapis.
export const resolveEvent: CommandHandler<ResolveEventCommand> = {
  category: 'workDay',
  execute(state, command, config) {
    const pending = state.events.pending;
    if (!pending) return reject('noPendingEvent');
    const option = eventTemplate(pending.templateId)?.options.find(
      (o) => o.id === command.optionId,
    );
    if (!option) return reject('unknownEventOption');
    const applied = applyEffects(
      state,
      option.effects,
      pending.projectId,
      pending.instanceId,
      config,
    );
    return {
      ok: true,
      state: {
        ...applied,
        mission: { ...applied.mission, speed: pending.resumeSpeed },
        events: { ...applied.events, pending: null },
      },
    };
  },
};
