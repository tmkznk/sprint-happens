import { reject, type ChooseRetroCardCommand, type CommandHandler } from './types';

// SH-056: wybór jednej karty z oferty retro (null — „Pomiń”). Przy pełnym limicie nowa karta
// zastępuje wskazaną aktywną.
export const chooseRetroCard: CommandHandler<ChooseRetroCardCommand> = {
  category: 'speed',
  execute(state, command, config) {
    const scrum = state.scrum;
    if (!scrum?.pendingRetro) return reject('noPendingRetro');
    if (command.cardId === null) {
      return { ok: true, state: { ...state, scrum: { ...scrum, pendingRetro: null } } };
    }
    if (!scrum.pendingRetro.offered.includes(command.cardId)) return reject('unknownCard');
    let cards = [...scrum.cards];
    if (cards.length >= config.scrum.cardLimit) {
      if (command.replace === null || !cards.includes(command.replace)) return reject('cardLimit');
      cards = cards.filter((id) => id !== command.replace);
    }
    cards.push(command.cardId);
    return { ok: true, state: { ...state, scrum: { ...scrum, cards, pendingRetro: null } } };
  },
};
