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

export type WallBand = {
  rect: Rect;
  axis: 'x' | 'y';
  // OFF-08 (O): wysokie są tylko odcinki leżące wzdłuż tylnych krawędzi (y = 0 wzdłuż X,
  // x = 0 wzdłuż Y); odnogi wchodzące do pokojów i ściany od strony kamery są niskie.
  back: boolean;
};

// Prosta ściana — jedna tafla przez całe pole (okna rysowane bez przerwy). Narożnik lub
// rozgałęzienie — rozłączne części: słupek i ramiona; bryły nie nachodzą na siebie, więc
// sortowanie według środka bryły rysuje je w poprawnej kolejności (bez „wcięć” na stykach).
export function wallBands(layout: OfficeLayout, cell: GridPoint): WallBand[] {
  if (!isWall(layout, cell)) return [];
  const t = WALL_THICKNESS;
  const low = 0.5 - t / 2;
  const high = 0.5 + t / 2;
  const { x, y } = cell;
  const left = isWallOrDoor(layout, { x: x - 1, y });
  const right = isWallOrDoor(layout, { x: x + 1, y });
  const up = isWallOrDoor(layout, { x, y: y - 1 });
  const down = isWallOrDoor(layout, { x, y: y + 1 });
  const alongX = left || right;
  const alongY = up || down;
  const backX = y === 0;
  const backY = x === 0;

  if (!alongY) {
    const x0 = x + (left ? 0 : low);
    const x1 = x + (right ? 1 : high);
    return [{ axis: 'x', back: backX, rect: { x: x0, y: y + low, width: x1 - x0, height: t } }];
  }
  if (!alongX) {
    const y0 = y + (up ? 0 : low);
    const y1 = y + (down ? 1 : high);
    return [{ axis: 'y', back: backY, rect: { x: x + low, y: y0, width: t, height: y1 - y0 } }];
  }
  const bands: WallBand[] = [
    { axis: 'y', back: backX || backY, rect: { x: x + low, y: y + low, width: t, height: t } },
  ];
  if (left) bands.push({ axis: 'x', back: backX, rect: { x, y: y + low, width: low, height: t } });
  if (right) {
    bands.push({
      axis: 'x',
      back: backX,
      rect: { x: x + high, y: y + low, width: low, height: t },
    });
  }
  if (up) bands.push({ axis: 'y', back: backY, rect: { x: x + low, y, width: t, height: low } });
  if (down) {
    bands.push({
      axis: 'y',
      back: backY,
      rect: { x: x + low, y: y + high, width: t, height: low },
    });
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
