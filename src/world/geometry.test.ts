import { describe, expect, it } from 'vitest';
import { ROTATIONS, type Furniture, type Rotation } from '../domain/furniture';
import type { FurnitureId } from '../domain/furniture';
import { footprintSize, interactionCells, occupiedCells, rotateOffset } from './geometry';

function furniture(type: Furniture['type'], rotation: Rotation): Furniture {
  return { id: 'furniture-1' as FurnitureId, type, origin: { x: 10, y: 10 }, rotation };
}

describe('geometry', () => {
  it('obrót o 90° zamienia wymiary footprintu biurka 3×2 na 2×3', () => {
    expect(footprintSize(furniture('desk', 0))).toEqual({ width: 3, height: 2 });
    expect(footprintSize(furniture('desk', 90))).toEqual({ width: 2, height: 3 });
  });

  it.each(ROTATIONS)('przy obrocie %s° liczba zajętych pól się nie zmienia', (rotation) => {
    expect(occupiedCells(furniture('desk', rotation))).toHaveLength(6);
  });

  it('cztery obroty o 90° wracają do położenia wyjściowego', () => {
    const size = { width: 3, height: 2 };
    let offset = { x: 1, y: 2 };
    let current = size;
    for (let i = 0; i < 4; i++) {
      offset = rotateOffset(offset, current, 90);
      current = { width: current.height, height: current.width };
    }
    expect(offset).toEqual({ x: 1, y: 2 });
  });

  it('punkt podejścia biurka leży tuż przed footprintem przy każdym obrocie', () => {
    const expected: Record<Rotation, { x: number; y: number }> = {
      0: { x: 11, y: 12 }, // pod frontem
      90: { x: 9, y: 11 }, // na lewo
      180: { x: 11, y: 9 }, // nad
      270: { x: 12, y: 11 }, // na prawo
    };
    for (const rotation of ROTATIONS) {
      const desk = furniture('desk', rotation);
      const [point] = interactionCells(desk);
      expect(point).toEqual(expected[rotation]);
      expect(occupiedCells(desk)).not.toContainEqual(point);
    }
  });

  it('kanapa ma dwa osobne punkty interakcji', () => {
    const points = interactionCells(furniture('sofa', 0));

    expect(points).toHaveLength(2);
    expect(points[0]).not.toEqual(points[1]);
  });
});
