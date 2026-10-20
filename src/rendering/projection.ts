import type { GridPoint } from '../domain/grid';

// T:ART-02 (R): kafelek izometryczny 64×32 piksele źródłowe.
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export type ScreenPoint = { x: number; y: number };

// T:ART-04 (R): screenX = (x−y)·32, screenY = (x+y)·16. Współrzędne siatki są ciągłe:
// pole (x, y) to kwadrat [x, x+1]×[y, y+1]; jego środek to (x+0.5, y+0.5).
export function gridToScreen(point: GridPoint): ScreenPoint {
  return {
    x: (point.x - point.y) * (TILE_WIDTH / 2),
    y: (point.x + point.y) * (TILE_HEIGHT / 2),
  };
}

export function screenToGrid(point: ScreenPoint): GridPoint {
  const a = point.x / (TILE_WIDTH / 2);
  const b = point.y / (TILE_HEIGHT / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

// Pole siatki pod punktem ekranu — podstawa wskazywania obiektów (SH-010).
export function cellAtScreen(point: ScreenPoint): GridPoint {
  const grid = screenToGrid(point);
  return { x: Math.floor(grid.x), y: Math.floor(grid.y) };
}

export function cellCenter(cell: GridPoint): GridPoint {
  return { x: cell.x + 0.5, y: cell.y + 0.5 };
}

// T:TIME-T02 — interpolacja wygładza ruch między stanami silnika; nie zmienia pozycji logicznej.
export function interpolate(previous: GridPoint, current: GridPoint, alpha: number): GridPoint {
  const t = Math.min(Math.max(alpha, 0), 1);
  return {
    x: previous.x + (current.x - previous.x) * t,
    y: previous.y + (current.y - previous.y) * t,
  };
}

// T:ART-05 (O): robocza kolejność zasłaniania według sumy współrzędnych środka footprintu
// (bliżej kamery = większa wartość). Suma przedniego narożnika dawała remis dla obiektu stojącego
// tuż przed innym (np. ekspres przed biurkiem 3×2). Dla nachodzących obiektów wielopolowych
// heurystyka może nie wystarczyć — scena testowa okluzji służy do wykrycia takich przypadków (SH-002).
export function depthOfFootprint(origin: GridPoint, size: { width: number; height: number }) {
  return origin.x + size.width / 2 + origin.y + size.height / 2;
}

export function depthOfPoint(point: GridPoint): number {
  // Niewielki naddatek rozstrzyga remis postaci z obiektem na korzyść postaci.
  return point.x + point.y + 0.01;
}
