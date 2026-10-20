import type { RejectionCode } from '../simulation/commands';

// Komunikaty odmów silnika dla gracza — silnik zwraca kod, tekst dobiera UI (SH-006).
export const REJECTION_MESSAGES: Record<RejectionCode, string> = {
  missionEnded: 'Misja została zakończona.',
  phaseNotAllowed: 'Ta czynność nie jest teraz dostępna.',
  invalidSpeed: 'Nieobsługiwane tempo gry.',
  unknownCandidate: 'Ten kandydat nie jest już dostępny.',
  noRoomToEnter: 'Przy wejściu nie ma wolnego miejsca — spróbuj za chwilę.',
  unknownEmployee: 'Ten pracownik nie jest już zatrudniony.',
  unknownFurniture: 'Tego mebla już nie ma.',
  notADesk: 'To nie jest stanowisko pracy.',
  deskTaken: 'To biurko jest już przypisane innej osobie.',
  notPaused: 'Edycja biura wymaga pauzy.',
  invalidRotation: 'Nieprawidłowy obrót.',
  outOfFloor: 'Mebel musi stać w całości na podłodze pokoju.',
  collision: 'Mebel koliduje z innym wyposażeniem.',
  occupiedByPerson: 'Na tym miejscu stoi pracownik.',
  blocksAccess: 'To ustawienie blokuje przejście, drzwi lub dostęp do mebla.',
  duplicateOperation: 'Ta operacja została już wykonana.',
  insufficientFunds: 'Brak wystarczających środków.',
  inDebt: 'Przy ujemnym saldzie nie można zatrudniać ani kupować wyposażenia.',
};
