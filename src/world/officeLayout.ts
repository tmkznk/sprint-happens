import type { Chapter } from '../domain/chapter';
import type { Rotation } from '../domain/furniture';
import type { GridPoint, Size } from '../domain/grid';

export type Rect = GridPoint & Size;

export type RoomId = 'main' | 'small' | 'social' | 'conference';

export type Room = { id: RoomId; bounds: Rect };

export type Door = { position: GridPoint; isEntrance: boolean };

export type OfficeLayout = {
  size: Size;
  rooms: readonly Room[];
  doors: readonly Door[];
  // Okna leżą na polach ścian; obecnie dekoracyjne (OFF-08).
  windows: readonly GridPoint[];
  // Teren poza ścianami biura (dojście od drzwi wejściowych i taras); leży poza siatką `size`.
  outdoor: readonly Rect[];
  // Miejsca do palenia na tarasie (pola `outdoor`).
  smokingSpots: readonly GridPoint[];
  // Ustawienie, od którego zaczyna się stawianie kupionego mebla (tryb „Urządź”).
  placementStart: { origin: GridPoint; rotation: Rotation };
};

export type CellKind = 'floor' | 'wall' | 'door' | 'outdoor';

// OFF-01, OFF-02 (O → decyzja właściciela 2026-10-29, makieta wariantu A): gotowe biuro z trzema
// pokojami. Z tyłu, pod wysokimi ścianami, mały gabinet szefa (5×4, jedno biurko) i pokój relaksu
// (7×4, kanapa i ekspres); z przodu open space (13×8, osiem biurek). Ściany zajmują pola: siatka
// 15×15, ściany działowe na y = 5 i x = 6. Wejście w wysokiej lewej ścianie, prosto do open space.
export const OFFICE_LAYOUT: OfficeLayout = {
  size: { width: 15, height: 15 },
  rooms: [
    { id: 'main', bounds: { x: 1, y: 6, width: 13, height: 8 } },
    { id: 'small', bounds: { x: 1, y: 1, width: 5, height: 4 } },
    { id: 'social', bounds: { x: 7, y: 1, width: 7, height: 4 } },
  ],
  // MOVE-05 (Z): wąskie drzwi o szerokości jednego pola.
  doors: [
    { position: { x: 0, y: 10 }, isEntrance: true },
    { position: { x: 3, y: 5 }, isEntrance: false },
    { position: { x: 10, y: 5 }, isEntrance: false },
  ],
  // Bez okien — na ścianach dekoracje (rendering).
  windows: [],
  // Dojście od drzwi wejściowych (x −2…−1, y 10…14) i taras (x −2…7, y 15…17) leżą poza
  // siatką biura. Miejsca do palenia: y = 16 (x −1…7) i y = 17 (x −1…6); (7,17) zajmuje popielnica.
  outdoor: [
    { x: -2, y: 10, width: 2, height: 5 },
    { x: -2, y: 15, width: 10, height: 3 },
  ],
  smokingSpots: [
    ...Array.from({ length: 9 }, (_, i) => ({ x: -1 + i, y: 16 })),
    ...Array.from({ length: 8 }, (_, i) => ({ x: -1 + i, y: 17 })),
  ],
  placementStart: { origin: { x: 8, y: 7 }, rotation: 0 },
};

// Prolog: małe biuro w jednym pokoju — miejsce tylko na dwa stanowiska, ekspres i roślinę.
export const PROLOGUE_LAYOUT: OfficeLayout = {
  size: { width: 8, height: 7 },
  rooms: [{ id: 'main', bounds: { x: 1, y: 1, width: 6, height: 5 } }],
  // Wejście w wysokiej lewej ścianie (drzwi z paczki widoczne w całości).
  doors: [{ position: { x: 0, y: 4 }, isEntrance: true }],
  // Bez okien — na ścianach dekoracje (obrazy, kratka; rendering).
  windows: [],
  outdoor: [],
  smokingSpots: [],
  // Jedyne wolne miejsce na drugie stanowisko: pod prawą ścianą, przodem do pokoju.
  placementStart: { origin: { x: 5, y: 3 }, rotation: 90 },
};

// Układ biura misji: w prologu małe biuro, we właściwej misji — pełne.
// Rozdział 2 (SH-051, wariant A — decyzja właściciela 2026-11-08): większe biuro. Z tyłu, pod
// wysokimi ścianami, gabinet szefa (5×5), salka konferencyjna (8×5) i relaks (4×5); z przodu
// open space 19×8 (dziesięć biurek). Siatka 21×16, ściany działowe na y = 6, x = 6 i x = 15.
// Wejście w wysokiej lewej ścianie (0,11); dojście i taras jak w biurze rozdziału 1, rząd niżej.
// Musi odpowiadać `chapterTwo` w tools/furniture-render/rooms.mjs.
export const CHAPTER_TWO_LAYOUT: OfficeLayout = {
  size: { width: 21, height: 16 },
  rooms: [
    { id: 'main', bounds: { x: 1, y: 7, width: 19, height: 8 } },
    { id: 'small', bounds: { x: 1, y: 1, width: 5, height: 5 } },
    { id: 'conference', bounds: { x: 7, y: 1, width: 8, height: 5 } },
    { id: 'social', bounds: { x: 16, y: 1, width: 4, height: 5 } },
  ],
  doors: [
    { position: { x: 0, y: 11 }, isEntrance: true },
    { position: { x: 3, y: 6 }, isEntrance: false },
    { position: { x: 11, y: 6 }, isEntrance: false },
    { position: { x: 17, y: 6 }, isEntrance: false },
  ],
  windows: [],
  // Dojście (x −2…−1, y 11…15) i taras (x −2…7, y 16…18); popielnica na (7,18).
  outdoor: [
    { x: -2, y: 11, width: 2, height: 5 },
    { x: -2, y: 16, width: 10, height: 3 },
  ],
  smokingSpots: [
    ...Array.from({ length: 9 }, (_, i) => ({ x: -1 + i, y: 17 })),
    ...Array.from({ length: 8 }, (_, i) => ({ x: -1 + i, y: 18 })),
  ],
  placementStart: { origin: { x: 9, y: 9 }, rotation: 0 },
};

export function officeLayoutOf(state: {
  readonly prologue: object | null;
  readonly mission: { readonly chapter: Chapter };
}): OfficeLayout {
  if (state.prologue) return PROLOGUE_LAYOUT;
  return state.mission.chapter === 2 ? CHAPTER_TWO_LAYOUT : OFFICE_LAYOUT;
}

export function isInside(rect: Rect, point: GridPoint): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + rect.width &&
    point.y < rect.y + rect.height
  );
}

export function roomAt(layout: OfficeLayout, point: GridPoint): Room | undefined {
  return layout.rooms.find((room) => isInside(room.bounds, point));
}

// Ściany nie są wymieniane osobno: każde pole siatki poza pokojami i drzwiami jest ścianą.
export function cellKindAt(layout: OfficeLayout, point: GridPoint): CellKind | null {
  if (layout.outdoor.some((rect) => isInside(rect, point))) return 'outdoor';
  if (!isInside({ x: 0, y: 0, ...layout.size }, point)) return null;
  if (layout.doors.some((door) => samePoint(door.position, point))) return 'door';
  return roomAt(layout, point) ? 'floor' : 'wall';
}

export function samePoint(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}
