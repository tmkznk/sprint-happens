import type { RejectionCode } from '../simulation/commands';

// Komunikaty odmów silnika dla gracza — silnik zwraca kod, tekst dobiera UI (SH-006).
export const REJECTION_MESSAGES: Record<RejectionCode, string> = {
  missionEnded: 'Misja została zakończona.',
  phaseNotAllowed: 'Ta czynność nie jest teraz dostępna.',
  invalidSpeed: 'Nieobsługiwane tempo gry.',
  duplicateOperation: 'Ta operacja została już wykonana.',
  insufficientFunds: 'Brak wystarczających środków.',
  inDebt: 'Przy ujemnym saldzie nie można zatrudniać ani kupować wyposażenia.',
};
