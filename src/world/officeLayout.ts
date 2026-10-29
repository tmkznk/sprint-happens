import type { Rotation } from '../domain/furniture';
import type { GridPoint, Size } from '../domain/grid';

export type Rect = GridPoint & Size;

export type RoomId = 'main' | 'small' | 'social';

export type Room = { id: RoomId; bounds: Rect };

export type Door = { position: GridPoint; isEntrance: boolean };

export type OfficeLayout = {
  size: Size;
  rooms: readonly Room[];
  doors: readonly Door[];
  // Okna leżą na polach ścian; obecnie dekoracyjne (OFF-08).
  windows: readonly GridPoint[];
  // Ustawienie, od którego zaczyna się stawianie kupionego mebla (tryb „Urządź”).
  placementStart: { origin: GridPoint; rotation: Rotation };
};

export type CellKind = 'floor' | 'wall' | 'door';

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
  // Jedyne wolne miejsce na drugie stanowisko: pod prawą ścianą, przodem do pokoju.
  placementStart: { origin: { x: 5, y: 3 }, rotation: 90 },
};

// Układ biura misji: w prologu małe biuro, we właściwej misji — pełne.
export function officeLayoutOf(state: { readonly prologue: object | null }): OfficeLayout {
  return state.prologue ? PROLOGUE_LAYOUT : OFFICE_LAYOUT;
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
  if (!isInside({ x: 0, y: 0, ...layout.size }, point)) return null;
  if (layout.doors.some((door) => samePoint(door.position, point))) return 'door';
  return roomAt(layout, point) ? 'floor' : 'wall';
}

export function samePoint(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}
