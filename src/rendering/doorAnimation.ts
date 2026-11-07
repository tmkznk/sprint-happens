import type { GridPoint } from '../domain/grid';
import type { DayPhase } from '../domain/state';

// Drzwi wejściowe — wyłącznie prezentacja (T:TIME-T02): stan otwarcia wynika z pozycji postaci
// w scenie, silnik i zapis go nie znają. Fazy otwarcia to wycinki tła z renderu pomieszczenia
// (`<id>-door.png`, tools/furniture-render); zamknięte drzwi to samo tło.

// Pełne otwarcie (albo zamknięcie) przy tempie 1× — w czasie gry, więc 4× jest szybsze, a pauza
// zatrzymuje drzwi.
export const DOOR_SWING_MS = 400;
// Odległość od środka pola drzwi (w polach), z której idąca postać otwiera drzwi.
const REACH = 1.3;
// Postać stojąca (nie idąca) trzyma drzwi otwarte tylko w samym przejściu.
const IN_DOORWAY = 0.6;

export type DoorVisitor = { position: GridPoint; walking: boolean };

// Rano (wchodzenie) i po pracy (wychodzenie) drzwi stoją otworem dla wszystkich — zamykają się
// dopiero po ostatniej osobie (decyzja właściciela 2026-11-07).
export function doorHeldOpen(phase: DayPhase): boolean {
  return phase === 'arriving' || phase === 'leaving';
}

// Tempo ruchu drzwi: jak gra; po pracy (zegar stoi, gra na pauzie z rozliczeniem) drzwi i tak
// domykają się za ostatnią osobą.
export function doorSpeed(phase: DayPhase, speed: number): number {
  return phase === 'workEnded' || phase === 'settled' ? 1 : speed;
}

export function doorWanted(cell: GridPoint, visitors: Iterable<DoorVisitor>): boolean {
  const cx = cell.x + 0.5;
  const cy = cell.y + 0.5;
  for (const { position, walking } of visitors) {
    const distance = Math.hypot(position.x - cx, position.y - cy);
    if (distance <= IN_DOORWAY || (walking && distance <= REACH)) return true;
  }
  return false;
}

// Otwarcie 0…1 po upływie `deltaMs` czasu klatki przy tempie gry `speed` (0 — pauza).
export function stepDoor(open: number, wanted: boolean, deltaMs: number, speed: number): number {
  const change = (deltaMs * speed) / DOOR_SWING_MS;
  return wanted ? Math.min(1, open + change) : Math.max(0, open - change);
}

// Klatka paska faz dla otwarcia 0…1 (fazy rosnąco, ostatnia = pełne otwarcie); null — zamknięte,
// widać samo tło.
export function doorFrame(open: number, frames: number): number | null {
  const index = Math.round(open * frames) - 1;
  return index < 0 ? null : Math.min(index, frames - 1);
}
