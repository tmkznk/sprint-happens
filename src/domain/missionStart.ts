import type { Furniture } from './furniture';

// MIS-01 (Z): start z dwoma stanowiskami pracy, kanapą i ekspresem. Ustawienie wskazane przez
// właściciela (2026-10-29): jedno biurko w open space pod lewą ścianą obok wejścia (krzesłem do
// pokoju), drugie w gabinecie szefa pod tylną ścianą. Pozycje (R) odnoszą się do układu biura
// z src/world/officeLayout.ts; ich zgodność z układem (brak kolizji, dostępne punkty interakcji)
// sprawdza test warstwy świata.
export const STARTING_FURNITURE: readonly Omit<Furniture, 'id'>[] = [
  { type: 'desk', origin: { x: 1, y: 6 }, rotation: 270 },
  { type: 'desk', origin: { x: 2, y: 1 }, rotation: 0 },
  { type: 'sofa', origin: { x: 8, y: 1 }, rotation: 0 },
  { type: 'coffeeMachine', origin: { x: 12, y: 1 }, rotation: 0 },
];
