import { FURNITURE_CATALOG, type Furniture, type Rotation } from '../domain/furniture';
import type { GridPoint, Size } from '../domain/grid';

export function rotatedSize(size: Size, rotation: Rotation): Size {
  return rotation === 90 || rotation === 270 ? { width: size.height, height: size.width } : size;
}

// Obraca przesunięcie względem footprintu tak, aby po obrocie footprint znów zaczynał się w (0,0).
// T:ART-03 — obrót zmienia footprint i punkty interakcji, nie tylko grafikę.
export function rotateOffset(offset: GridPoint, size: Size, rotation: Rotation): GridPoint {
  switch (rotation) {
    case 0:
      return offset;
    case 90:
      return { x: size.height - 1 - offset.y, y: offset.x };
    case 180:
      return { x: size.width - 1 - offset.x, y: size.height - 1 - offset.y };
    case 270:
      return { x: offset.y, y: size.width - 1 - offset.x };
  }
}

export function footprintSize(furniture: Furniture): Size {
  return rotatedSize(FURNITURE_CATALOG[furniture.type].footprint, furniture.rotation);
}

export function occupiedCells(furniture: Furniture): GridPoint[] {
  const { width, height } = footprintSize(furniture);
  const cells: GridPoint[] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      cells.push({ x: furniture.origin.x + dx, y: furniture.origin.y + dy });
    }
  }
  return cells;
}

export function interactionCells(furniture: Furniture): GridPoint[] {
  const spec = FURNITURE_CATALOG[furniture.type];
  return spec.interactionPoints.map((point) => {
    const offset = rotateOffset(point, spec.footprint, furniture.rotation);
    return { x: furniture.origin.x + offset.x, y: furniture.origin.y + offset.y };
  });
}
