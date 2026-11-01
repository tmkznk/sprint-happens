import type { PersonId } from '../domain/content/people';
import { personById } from '../domain/content/people';
import type { Employee } from '../domain/employees';
import type { GameState } from '../domain/state';
import { DAY_LENGTH_MS } from './time';

// Harmonogram papierosów: pory dnia wynikają wyłącznie z personId i liczby papierosów
// (całkowite ms, bez RNG), więc są identyczne przy każdym tempie i po wczytaniu zapisu.
// Zapis przechowuje tylko licznik obsłużonych pór (`Employee.cigarettesHandled`).

// FNV-1a (32 bit) po znakach personId.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Ile pór papierosa minęło do danej chwili dnia (0…cigarettes).
export function cigaretteSlotsPassed(
  personId: PersonId,
  cigarettes: number,
  timeInDayMs: number,
): number {
  if (cigarettes <= 0) return 0;
  const interval = Math.floor(DAY_LENGTH_MS / cigarettes);
  const offset = Math.floor(interval / 4) + (hash(personId) % Math.floor(interval / 2));
  const passed = timeInDayMs < offset ? 0 : Math.floor((timeInDayMs - offset) / interval) + 1;
  return Math.min(cigarettes, passed);
}

function slotsPassedNow(state: GameState, employee: Employee): number {
  const cigarettes = personById(employee.personId)?.cigarettesPerDay ?? 0;
  return cigaretteSlotsPassed(employee.personId, cigarettes, state.mission.timeInDayMs);
}

// Czy jest zaległa pora papierosa. W prologu nikt nie pali.
export function cigaretteDue(state: GameState, employee: Employee): boolean {
  if (state.prologue) return false;
  return slotsPassedNow(state, employee) > employee.cigarettesHandled;
}

// Oznacza wszystkie dotychczasowe pory jako obsłużone (rozkaz gracza, zatrudnienie).
export function markCigarettesHandled(state: GameState, employee: Employee): Employee {
  return { ...employee, cigarettesHandled: slotsPassedNow(state, employee) };
}
