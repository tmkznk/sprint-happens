import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { GridPoint } from '../domain/grid';
import { createInitialState } from '../domain/state';
import { interactionCells, occupiedCells } from './geometry';
import { cellKindAt, OFFICE_LAYOUT, roomAt } from './officeLayout';

const layout = OFFICE_LAYOUT;
const key = (point: GridPoint) => `${point.x},${point.y}`;

describe('OFFICE_LAYOUT', () => {
  // OFF-02: układ i wymiary pokoi to decyzja właściciela (2026-10-29).
  it('ma pokoje o ustalonych wymiarach (open space, gabinet, pokój relaksu)', () => {
    const sizes = Object.fromEntries(
      layout.rooms.map((room) => [room.id, [room.bounds.width, room.bounds.height]]),
    );
    expect(sizes).toEqual({ main: [13, 8], small: [5, 4], social: [7, 4] });
  });

  it('jest otoczone zamkniętą ramą ścian z jednym wejściem', () => {
    const { width, height } = layout.size;
    const border: GridPoint[] = [];
    for (let x = 0; x < width; x++) border.push({ x, y: 0 }, { x, y: height - 1 });
    for (let y = 1; y < height - 1; y++) border.push({ x: 0, y }, { x: width - 1, y });

    const openings = border.filter((point) => cellKindAt(layout, point) !== 'wall');
    expect(openings).toEqual([layout.doors.find((door) => door.isEntrance)?.position]);
  });

  it('każde drzwi łączą dwa obszary przez ścianę', () => {
    for (const door of layout.doors) {
      const { x, y } = door.position;
      const horizontal = [roomAt(layout, { x: x - 1, y }), roomAt(layout, { x: x + 1, y })];
      const vertical = [roomAt(layout, { x, y: y - 1 }), roomAt(layout, { x, y: y + 1 })];
      const sides = horizontal.some(Boolean) ? horizontal : vertical;
      expect(sides.filter(Boolean).length, `drzwi ${key(door.position)}`).toBeGreaterThanOrEqual(
        door.isEntrance ? 1 : 2,
      );
    }
  });

  it('nie ma okien; każde zadeklarowane okno musiałoby leżeć na ścianie', () => {
    expect(layout.windows).toEqual([]);
    for (const window of layout.windows) expect(cellKindAt(layout, window)).toBe('wall');
  });
});

describe('startowe wyposażenie', () => {
  const furniture = Object.values(createInitialState(DEFAULT_BALANCE, 1).world.furniture);

  it('obejmuje dwa biurka, kanapę i ekspres (MIS-01)', () => {
    expect(furniture.map((item) => item.type).sort()).toEqual([
      'coffeeMachine',
      'desk',
      'desk',
      'sofa',
    ]);
  });

  it('stoi na podłodze, w jednym pokoju i bez kolizji', () => {
    const taken = new Set<string>();
    for (const item of furniture) {
      const cells = occupiedCells(item);
      const rooms = new Set(cells.map((cell) => roomAt(layout, cell)?.id));
      expect(rooms.size, item.id).toBe(1);
      for (const cell of cells) {
        expect(cellKindAt(layout, cell), `${item.id} ${key(cell)}`).toBe('floor');
        expect(taken.has(key(cell)), `kolizja ${key(cell)}`).toBe(false);
        taken.add(key(cell));
      }
    }
  });

  it('ma punkty interakcji na wolnej podłodze', () => {
    const taken = new Set(furniture.flatMap(occupiedCells).map(key));
    for (const item of furniture) {
      for (const point of interactionCells(item)) {
        expect(cellKindAt(layout, point), `${item.id} ${key(point)}`).toBe('floor');
        expect(taken.has(key(point)), `${item.id} ${key(point)}`).toBe(false);
      }
    }
  });
});
