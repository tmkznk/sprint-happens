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
const onBack = (name, x, y, extra = {}) => ({ name, x, z: FACE, y, rotY: 0, ...extra });
const onLeft = (name, z, y, extra = {}) => ({ name, x: FACE, z, y, rotY: 90, ...extra });

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
      onLeft('Painting', 2.9, 1.7),
    ],
  },
};
