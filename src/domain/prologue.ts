// Prolog (samouczek przed właściwą misją): kroki w kolejności rozgrywki. Pięć celów prologu
// obejmuje po jednym lub kilka kroków — krok wskazuje bieżące zadanie gracza, a przejście
// do następnego rozstrzyga silnik na podstawie stanu gry (wykonanych działań, nie czasu).
export const PROLOGUE_STEPS = [
  // Cel 1: przyjąć pierwsze zlecenie.
  'acceptFirst',
  // Cel 2: przypisać Janusza; potem realizacja i rozliczenie pierwszego projektu.
  'assignOwner',
  'deliverFirst',
  // Cel 3: kupić i ustawić stanowisko dla nowego pracownika.
  'buyDesk',
  // Cel 4: zatrudnić backendowca.
  'hireHelper',
  // Cel 5: przyjąć drugie zlecenie, przydzielić obu i ukończyć projekt.
  'acceptSecond',
  'assignTeam',
  'deliverSecond',
  // Wszystkie cele zaliczone — komunikat końcowy i przejście do właściwej misji.
  'finished',
] as const;
export type PrologueStep = (typeof PROLOGUE_STEPS)[number];

export type PrologueState = { step: PrologueStep };

export const PROLOGUE_GOAL_COUNT = 5;

// Numer celu (1–5) realizowanego w danym kroku; po zakończeniu — 6 (wszystkie zaliczone).
const GOAL_OF_STEP: Record<PrologueStep, number> = {
  acceptFirst: 1,
  assignOwner: 2,
  deliverFirst: 3,
  buyDesk: 3,
  hireHelper: 4,
  acceptSecond: 5,
  assignTeam: 5,
  deliverSecond: 5,
  finished: 6,
};

// Liczba zaliczonych celów. Przypisanie Janusza zalicza cel drugi; realizacja pierwszego
// projektu nie jest osobnym celem.
export function completedGoals(step: PrologueStep): number {
  return GOAL_OF_STEP[step] - 1;
}

// Czy krok `step` jest już osiągnięty (bieżący albo późniejszy) — „poznane funkcje pozostają
// dostępne w kolejnych etapach”.
export function reached(state: PrologueState, step: PrologueStep): boolean {
  return PROLOGUE_STEPS.indexOf(state.step) >= PROLOGUE_STEPS.indexOf(step);
}
