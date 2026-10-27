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

// OFF-01/OFF-02, T:ART-02 (R): gotowe biuro z trzema pokojami. Wymiary pokoi zgodne ze
// specyfikacją (10×12, 6×6, 6×5); ściany zajmują pola, więc pełna rama wymaga siatki 19×14,
// a nie roboczych 18×14. Układ do weryfikacji makietą w SH-002.
export const OFFICE_LAYOUT: OfficeLayout = {
  size: { width: 19, height: 14 },
  rooms: [
    { id: 'main', bounds: { x: 1, y: 1, width: 10, height: 12 } },
    { id: 'small', bounds: { x: 12, y: 1, width: 6, height: 6 } },
    { id: 'social', bounds: { x: 12, y: 8, width: 6, height: 5 } },
  ],
  // MOVE-05 (Z): wąskie drzwi o szerokości jednego pola.
  doors: [
    { position: { x: 5, y: 13 }, isEntrance: true },
    { position: { x: 11, y: 3 }, isEntrance: false },
    { position: { x: 11, y: 10 }, isEntrance: false },
  ],
  windows: [
    { x: 3, y: 0 },
    { x: 7, y: 0 },
    { x: 14, y: 0 },
    { x: 0, y: 4 },
    { x: 0, y: 9 },
  ],
  placementStart: { origin: { x: 4, y: 8 }, rotation: 0 },
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
