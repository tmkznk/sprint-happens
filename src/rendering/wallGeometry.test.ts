import { describe, expect, it } from 'vitest';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import { doorThreshold, WALL_THICKNESS, wallBands, wallFloorQuarters } from './wallGeometry';

const t = WALL_THICKNESS;
const low = 0.5 - t / 2;
const high = 0.5 + t / 2;

describe('cienkie ściany (prezentacja)', () => {
  it('prosta ściana tylna: jedna wysoka tafla wzdłuż X przez całe pole', () => {
    expect(wallBands(OFFICE_LAYOUT, { x: 3, y: 0 })).toEqual([
      { axis: 'x', back: true, rect: { x: 3, y: low, width: 1, height: t } },
    ]);
  });

  it('narożnik (0,0): rozłączny słupek i ramiona, wszystkie wysokie', () => {
    const bands = wallBands(OFFICE_LAYOUT, { x: 0, y: 0 });
    expect(bands).toEqual([
      { axis: 'y', back: true, rect: { x: low, y: low, width: t, height: t } },
      { axis: 'x', back: true, rect: { x: high, y: low, width: low, height: t } },
      { axis: 'y', back: true, rect: { x: low, y: high, width: t, height: low } },
    ]);
  });

  it('części narożnika nie nachodzą na siebie', () => {
    for (const cell of [
      { x: 0, y: 0 },
      { x: 0, y: 13 },
      { x: 18, y: 0 },
      { x: 11, y: 0 },
      { x: 11, y: 7 },
    ]) {
      const rects = wallBands(OFFICE_LAYOUT, cell).map((b) => b.rect);
      for (const [i, a] of rects.entries()) {
        for (const b of rects.slice(i + 1)) {
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          expect(overlapX > 1e-9 && overlapY > 1e-9).toBe(false);
        }
      }
    }
  });

  it('rozgałęzienie przy tylnej ścianie: odnoga do pokoju jest niska (bez wysokiego kikuta)', () => {
    const bands = wallBands(OFFICE_LAYOUT, { x: 11, y: 0 });
    expect(bands.filter((b) => b.axis === 'x').every((b) => b.back)).toBe(true);
    const down = bands.find((b) => b.rect.y > low && b.axis === 'y');
    expect(down?.back).toBe(false);
  });

  it('narożnik przód-lewy (0,13): ściana lewa wysoka, frontowa niska', () => {
    const bands = wallBands(OFFICE_LAYOUT, { x: 0, y: 13 });
    expect(bands.find((b) => b.axis === 'x')?.back).toBe(false);
    expect(bands.filter((b) => b.axis === 'y').every((b) => b.back)).toBe(true);
  });

  it('ściana przy drzwiach dochodzi do krawędzi drzwi', () => {
    // (11,2) nad drzwiami (11,3): tafla pionowa sięga dolnej krawędzi pola.
    const vertical = wallBands(OFFICE_LAYOUT, { x: 11, y: 2 }).find((b) => b.axis === 'y');
    expect(vertical?.rect.y).toBe(2);
    expect(vertical && vertical.rect.y + vertical.rect.height).toBe(3);
  });

  it('podłoga pokoju nie ma tafli ani ćwiartek', () => {
    expect(wallBands(OFFICE_LAYOUT, { x: 5, y: 5 })).toEqual([]);
    expect(wallFloorQuarters(OFFICE_LAYOUT, { x: 5, y: 5 })).toEqual([]);
  });

  it('drzwi: podłoga pokojów po obu stronach i wąski próg w linii ściany', () => {
    // Drzwi wewnętrzne (11,3) w pionowej ścianie — próg wzdłuż Y.
    expect(doorThreshold(OFFICE_LAYOUT, { x: 11, y: 3 })).toEqual({
      x: 11 + low,
      y: 3,
      width: t,
      height: 1,
    });
    expect(wallFloorQuarters(OFFICE_LAYOUT, { x: 11, y: 3 }).map((q) => q.room.id)).toEqual([
      'main',
      'small',
      'main',
      'small',
    ]);
    // Wejście (5,13) w ścianie frontowej — próg wzdłuż X, od zewnątrz bez podłogi.
    expect(doorThreshold(OFFICE_LAYOUT, { x: 5, y: 13 })?.width).toBe(1);
    expect(wallFloorQuarters(OFFICE_LAYOUT, { x: 5, y: 13 })).toHaveLength(2);
    expect(doorThreshold(OFFICE_LAYOUT, { x: 5, y: 5 })).toBeNull();
  });

  it('ściana między pokojami: ćwiartki z obu stron dostają podłogę właściwego pokoju', () => {
    const quarters = wallFloorQuarters(OFFICE_LAYOUT, { x: 11, y: 5 });
    expect(quarters.map((q) => [q.rect.x, q.room.id])).toEqual([
      [11, 'main'],
      [11.5, 'small'],
      [11, 'main'],
      [11.5, 'small'],
    ]);
  });

  it('ściana zewnętrzna: ćwiartki od zewnątrz biura zostają puste', () => {
    const quarters = wallFloorQuarters(OFFICE_LAYOUT, { x: 3, y: 0 });
    expect(quarters.every((q) => q.rect.y === 0.5 && q.room.id === 'main')).toBe(true);
    expect(quarters).toHaveLength(2);
  });
});
