import { describe, expect, it } from 'vitest';
import { cellKey, gridFromAscii } from './grid';
import { findPath, reachableCells } from './pathfinding';

const { grid, points } = gridFromAscii(['#######', '#A..#.#', '#.#.#.#', '#...#b#', '#######']);
const A = points.A ?? { x: 0, y: 0 };

describe('findPath', () => {
  it('znajduje najkrótszą trasę po czterech sąsiadach, omijając ściany', () => {
    const path = findPath(grid, A, { x: 3, y: 3 });

    expect(path).toHaveLength(4);
    for (const [i, cell] of (path ?? []).entries()) {
      const previous = i === 0 ? A : (path ?? [])[i - 1];
      if (!previous) continue;
      expect(Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y)).toBe(1);
      expect(grid.passable(cell)).toBe(true);
    }
  });

  it('zwraca null dla celu nieosiągalnego i pustą trasę dla celu w miejscu', () => {
    expect(findPath(grid, A, points.b ?? A)).toBeNull();
    expect(findPath(grid, A, A)).toEqual([]);
  });

  it('omija pola oznaczone jako tymczasowo zablokowane', () => {
    const path = findPath(grid, A, { x: 3, y: 3 }, new Set([cellKey({ x: 2, y: 1 })]));

    expect(path?.map(cellKey)).toEqual(['1,2', '1,3', '2,3', '3,3']);
  });

  it('jest deterministyczny przy równych trasach', () => {
    expect(findPath(grid, A, { x: 3, y: 3 })).toEqual(findPath(grid, A, { x: 3, y: 3 }));
  });
});

describe('reachableCells', () => {
  it('zwraca tylko pola połączone ze startem', () => {
    const reachable = reachableCells(grid, A);

    expect(reachable.has(cellKey({ x: 3, y: 1 }))).toBe(true);
    expect(reachable.has(cellKey(points.b ?? A))).toBe(false);
  });
});
