// Postacie z paczki Kenney Mini Characters (CC0): wybrane wyglądy, kierunki i animacje atlasu.
export const LOOKS = [
  'female-b',
  'female-c',
  'female-d',
  'female-e',
  'female-f',
  'male-a',
  'male-b',
  'male-d',
  'male-e',
  'male-f',
];

// Kąt obrotu modelu (przód modelu = +Z) dla kierunku patrzenia w siatce gry (x → +X, y → +Z).
export const FACINGS = [
  { name: 'px', angle: 90 },
  { name: 'py', angle: 0 },
  { name: 'nx', angle: 270 },
  { name: 'ny', angle: 180 },
];

// Wysokość siedziska nad podłogą (m) — skalibrowana z krzesłem i kanapą z paczki VNB.
export const CHAIR_SEAT = 0.4;
export const SOFA_SEAT = 0.35;

export const ANIMS = [
  { name: 'idle', clip: 'idle', frames: 2, fps: 2 },
  { name: 'walk', clip: 'walk', frames: 8, fps: 12 },
  { name: 'sitChair', clip: 'sit', frames: 1, fps: 1, lift: CHAIR_SEAT },
  { name: 'typing', clip: 'typing', frames: 4, fps: 6, lift: CHAIR_SEAT },
  { name: 'sitSofa', clip: 'sit', frames: 1, fps: 1, lift: SOFA_SEAT },
  { name: 'coffee', clip: 'interact-right', frames: 4, fps: 6 },
];

export const CHARACTER = {
  metersPerTile: 0.75,
  heightM: 1.2,
  // Ramka klatki w kaflach: szerokość, wysokość, położenie stóp od góry.
  box: { w: 1.8, h: 2.3, up: 1.95 },
};
