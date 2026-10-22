import type { GridPoint } from '../domain/grid';
import { cellKindAt, roomAt, type OfficeLayout, type Rect, type Room } from '../world/officeLayout';

// Prezentacja ścian (SH-034, uwaga właściciela: ściany były za grube). Logicznie ściana zajmuje
// całe pole siatki (ruch, rezerwacje — bez zmian); wizualnie to cienka tafla biegnąca środkiem
// pola, połączona z sąsiednimi ścianami i dochodząca do krawędzi drzwi. Reszta pola ściany
// dostaje podłogę przyległego pokoju, więc pokoje sięgają do tafli.

export const WALL_THICKNESS = 0.22;

const isWall = (layout: OfficeLayout, point: GridPoint) => cellKindAt(layout, point) === 'wall';
const isWallOrDoor = (layout: OfficeLayout, point: GridPoint) => {
  const kind = cellKindAt(layout, point);
  return kind === 'wall' || kind === 'door';
};

export type WallBand = { rect: Rect; axis: 'x' | 'y' };

// Do dwóch tafli na pole: wzdłuż osi X (łączy sąsiadów lewo/prawo) i osi Y (góra/dół).
// Pole bez sąsiadów-ścian dostaje słupek o przekroju grubości ściany.
export function wallBands(layout: OfficeLayout, cell: GridPoint): WallBand[] {
  if (!isWall(layout, cell)) return [];
  const t = WALL_THICKNESS;
  const low = 0.5 - t / 2;
  const high = 0.5 + t / 2;
  const left = isWallOrDoor(layout, { x: cell.x - 1, y: cell.y });
  const right = isWallOrDoor(layout, { x: cell.x + 1, y: cell.y });
  const up = isWallOrDoor(layout, { x: cell.x, y: cell.y - 1 });
  const down = isWallOrDoor(layout, { x: cell.x, y: cell.y + 1 });
  const bands: WallBand[] = [];
  if (left || right || (!up && !down)) {
    const x0 = cell.x + (left ? 0 : low);
    const x1 = cell.x + (right ? 1 : high);
    bands.push({ axis: 'x', rect: { x: x0, y: cell.y + low, width: x1 - x0, height: t } });
  }
  if (up || down) {
    const y0 = cell.y + (up ? 0 : low);
    const y1 = cell.y + (down ? 1 : high);
    bands.push({ axis: 'y', rect: { x: cell.x + low, y: y0, width: t, height: y1 - y0 } });
  }
  return bands;
}

// Ćwiartki pola ściany lub drzwi wypełniane podłogą pokoju, który do nich przylega (najpierw
// sąsiad w poziomie, potem w pionie, na końcu po skosie). Ćwiartki od zewnątrz biura — puste.
export function wallFloorQuarters(
  layout: OfficeLayout,
  cell: GridPoint,
): { rect: Rect; room: Room }[] {
  if (!isWallOrDoor(layout, cell)) return [];
  const quarters: { rect: Rect; room: Room }[] = [];
  for (const dy of [-1, 1]) {
    for (const dx of [-1, 1]) {
      const room =
        roomAt(layout, { x: cell.x + dx, y: cell.y }) ??
        roomAt(layout, { x: cell.x, y: cell.y + dy }) ??
        roomAt(layout, { x: cell.x + dx, y: cell.y + dy });
      if (!room) continue;
      quarters.push({
        room,
        rect: {
          x: cell.x + (dx < 0 ? 0 : 0.5),
          y: cell.y + (dy < 0 ? 0 : 0.5),
          width: 0.5,
          height: 0.5,
        },
      });
    }
  }
  return quarters;
}

// Próg drzwi: wąski pas w linii ściany (oś wyznaczają sąsiednie ściany), szeroki na całe pole.
export function doorThreshold(layout: OfficeLayout, cell: GridPoint): Rect | null {
  if (cellKindAt(layout, cell) !== 'door') return null;
  const t = WALL_THICKNESS;
  const low = 0.5 - t / 2;
  const alongX =
    isWall(layout, { x: cell.x - 1, y: cell.y }) || isWall(layout, { x: cell.x + 1, y: cell.y });
  return alongX
    ? { x: cell.x, y: cell.y + low, width: 1, height: t }
    : { x: cell.x + low, y: cell.y, width: t, height: 1 };
}
