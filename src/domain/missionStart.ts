import type { Furniture } from './furniture';

// MIS-01 (Z): start z dwoma stanowiskami pracy, kanapą i ekspresem.
// Pozycje (R) odnoszą się do układu biura z src/world/officeLayout.ts; ich zgodność
// z układem (brak kolizji, dostępne punkty interakcji) sprawdza test warstwy świata.
export const STARTING_FURNITURE: readonly Omit<Furniture, 'id'>[] = [
  { type: 'desk', origin: { x: 2, y: 2 }, rotation: 0 },
  { type: 'desk', origin: { x: 6, y: 2 }, rotation: 0 },
  { type: 'sofa', origin: { x: 13, y: 9 }, rotation: 0 },
  { type: 'coffeeMachine', origin: { x: 17, y: 8 }, rotation: 0 },
];
