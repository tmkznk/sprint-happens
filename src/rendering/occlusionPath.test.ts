import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { GridPoint } from '../domain/grid';
import { createInitialState } from '../domain/state';
import { occupiedCells } from '../world/geometry';
import { cellKindAt, OFFICE_LAYOUT } from '../world/officeLayout';
import { expandWaypoints, OCCLUSION_WAYPOINTS } from './occlusionPath';

const key = (point: GridPoint) => `${point.x},${point.y}`;

describe('expandWaypoints', () => {
  it('rozwija punkty w kolejne sąsiednie pola', () => {
    expect(
      expandWaypoints([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ]);
  });

  it('odrzuca ruch po przekątnej', () => {
    expect(() =>
      expandWaypoints([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toThrow();
  });

  it('trasa testowa prowadzi tylko po wolnej podłodze i drzwiach', () => {
    const furniture = Object.values(createInitialState(DEFAULT_BALANCE, 1).world.furniture);
    const taken = new Set(furniture.flatMap(occupiedCells).map(key));

    for (const cell of expandWaypoints(OCCLUSION_WAYPOINTS)) {
      expect(['floor', 'door'], key(cell)).toContain(cellKindAt(OFFICE_LAYOUT, cell));
      expect(taken.has(key(cell)), key(cell)).toBe(false);
    }
  });
});
