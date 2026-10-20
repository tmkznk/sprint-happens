import type { DayPhase } from '../../domain/state';

// TIME-08 (Z): każde polecenie należy do jednej kategorii, która wyznacza dozwolone fazy dnia.
// Nowe polecenie wybiera kategorię zamiast deklarować fazy samodzielnie (SH-008).
export const PHASES_BY_CATEGORY = {
  // Działania dnia pracy: zatrudnianie, zwalnianie, kontrakty, wyposażenie, przydziały, tempo.
  workDay: ['working'],
  // Oddanie projektu: także po zakończeniu pracy, przed rozliczeniem (TIME-08, FIN-04).
  delivery: ['working', 'workEnded'],
  // Dokładnie jedno rozliczenie na dzień, po zakończeniu pracy.
  settlement: ['workEnded'],
  // „Następny dzień” po raporcie z rozliczenia.
  nextDay: ['settled'],
} as const satisfies Record<string, readonly DayPhase[]>;

export type CommandCategory = keyof typeof PHASES_BY_CATEGORY;
