// Pomieszczenia renderowane w całości (podłoga, ściany z drzwiami, dekoracje ścian) w siatce gry.
// Współrzędne w polach: x → X, y gry → Z; ściany leżą na linii środka pola ściany (tafla 0,22 pola),
// wysokości w metrach. Układ musi odpowiadać src/world/officeLayout.ts.
const M = 0.75;
const T = (m) => m / M;
const WALL = 0.22;
// Wysokie ściany sięgają do zewnętrznych narożników, niskie ściany przednie dochodzą do ich lica
// (bez przenikania brył). Lico ściany od strony pokoju + grubość ramy obrazu:
const FACE = 0.5 + WALL / 2 + T(0.03);

const MUSTARD = 0xe0a640;
const GREEN = 0x9db58f;
const BURGUNDY = 0x8e4f5f;
const TALL = 2.4;
const LOW = 0.35;
const onBack = (name, x, y, extra = {}) => ({ name, x, z: FACE, y, rotY: 0, ...extra });
const onLeft = (name, z, y, extra = {}) => ({ name, x: FACE, z, y, rotY: 90, ...extra });

const FLOOR = {
  colors: [0xb98e5e, 0xb08657],
  border: 0xa67c4f,
  grout: 0x7e5f3c,
};

// Prolog: PROLOGUE_LAYOUT — siatka 8×7, pokój (1,1)–(6,5), wejście (0,4) w lewej ścianie.
const DOOR_CENTER = 4.5;
const OPENING = T(0.55);

export const ROOMS = {
  prologue: {
    metersPerTile: M,
    wallThickness: WALL,
    floor: {
      x0: 0.5,
      z0: 0.5,
      x1: 7.5,
      z1: 6.5,
      // Płytki na polach pokoju (1,1)–(6,5); pas przy ścianach w kolorze ciemniejszej płytki.
      tiles: { x0: 1, z0: 1, x1: 7, z1: 6 },
      colors: [0xb98e5e, 0xb08657],
      border: 0xa67c4f,
      grout: 0x7e5f3c,
    },
    walls: [
      { axis: 'x', at: 0.5, from: 0.39, to: 7.61, height: 2.4, color: MUSTARD },
      {
        axis: 'z',
        at: 0.5,
        from: 0.61,
        to: 6.61,
        height: 2.4,
        color: MUSTARD,
        openings: [[DOOR_CENTER - OPENING, DOOR_CENTER + OPENING]],
      },
      {
        axis: 'x',
        at: 6.5,
        from: 0.61,
        to: 7.61,
        height: 0.35,
        color: MUSTARD,
        front: true,
      },
      {
        axis: 'z',
        at: 7.5,
        from: 0.61,
        to: 6.39,
        height: 0.35,
        color: MUSTARD,
        front: true,
      },
    ],
    doors: [{ axis: 'z', at: 0.5, center: DOOR_CENTER, leaf: 'Door_2', handle: 'Door_Handle_1' }],
    decor: [
      onBack('Painting_Small', 2.3, 1.75),
      onBack('Painting', 4.4, 1.7),
      onBack('Vent', 6.4, 2.05, { scale: 0.6 }),
      onLeft('Painting_Photo', 1.4, 1.75),
      onLeft('Painting_Photo', 1.95, 1.55),
    ],
  },
  // Misja: OFFICE_LAYOUT — siatka 15×15. Z tyłu gabinet szefa (1,1)–(5,4) i relaks (7,1)–(13,4),
  // z przodu open space (1,6)–(13,13); ściany działowe y = 5 i x = 6 (niskie, każda strona
  // w kolorze swojego pokoju), wejście (0,10) w lewej ścianie. Kolory: open space — zieleń,
  // gabinet — bordo, relaks — musztarda (decyzja właściciela 2026-10-29).
  office: {
    metersPerTile: M,
    wallThickness: WALL,
    floor: {
      x0: 0.5,
      z0: 0.5,
      x1: 14.5,
      z1: 14.5,
      tiles: [
        { x0: 1, z0: 1, x1: 6, z1: 5 },
        { x0: 7, z0: 1, x1: 14, z1: 5 },
        { x0: 1, z0: 6, x1: 14, z1: 14 },
      ],
      ...FLOOR,
    },
    walls: [
      { axis: 'x', at: 0.5, from: 0.39, to: 6.5, height: TALL, color: BURGUNDY },
      { axis: 'x', at: 0.5, from: 6.5, to: 14.61, height: TALL, color: MUSTARD },
      { axis: 'z', at: 0.5, from: 0.61, to: 5.5, height: TALL, color: BURGUNDY },
      {
        axis: 'z',
        at: 0.5,
        from: 5.5,
        to: 14.61,
        height: TALL,
        color: GREEN,
        openings: [[10.5 - OPENING, 10.5 + OPENING]],
      },
      { axis: 'x', at: 14.5, from: 0.61, to: 14.61, height: LOW, color: GREEN, front: true },
      { axis: 'z', at: 14.5, from: 0.61, to: 5.5, height: LOW, color: MUSTARD, front: true },
      { axis: 'z', at: 14.5, from: 5.5, to: 14.39, height: LOW, color: GREEN, front: true },
      // Działowe: `sides` — strona o mniejszej współrzędnej, potem większej. Przejścia bez drzwi
      // i ościeżnic, poszerzone do szerokości otworu drzwi wejściowych (decyzja właściciela).
      {
        axis: 'x',
        at: 5.5,
        from: 0.61,
        to: 6.5,
        height: LOW,
        sides: [BURGUNDY, GREEN],
        openings: [[3.5 - OPENING, 3.5 + OPENING]],
        partition: true,
      },
      {
        axis: 'x',
        at: 5.5,
        from: 6.5,
        to: 14.39,
        height: LOW,
        sides: [MUSTARD, GREEN],
        openings: [[10.5 - OPENING, 10.5 + OPENING]],
        partition: true,
      },
      {
        axis: 'z',
        at: 6.5,
        from: 0.61,
        to: 5.39,
        height: LOW,
        sides: [BURGUNDY, MUSTARD],
        partition: true,
      },
    ],
    doors: [{ axis: 'z', at: 0.5, center: 10.5, leaf: 'Door_2', handle: 'Door_Handle_1' }],
    decor: [
      // Gabinet szefa: obrazy na obu wysokich ścianach.
      onBack('Painting', 3.5, 1.75),
      onLeft('Painting_Photo', 1.6, 1.75),
      onLeft('Painting_Photo', 2.2, 1.55),
      onLeft('Painting_Small', 3.6, 1.7),
      // Relaks i open space — kratki wentylacyjne.
      onBack('Vent', 12.4, 2.05, { scale: 0.6 }),
      onLeft('Vent', 7.4, 2.05, { scale: 0.6 }),
    ],
  },
};
