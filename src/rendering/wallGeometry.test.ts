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
      { x: 0, y: 14 },
      { x: 14, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 5 },
      { x: 0, y: 5 },
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
    const bands = wallBands(OFFICE_LAYOUT, { x: 6, y: 0 });
    expect(bands.filter((b) => b.axis === 'x').every((b) => b.back)).toBe(true);
    const down = bands.find((b) => b.rect.y > low && b.axis === 'y');
    expect(down?.back).toBe(false);
  });

  it('narożnik przód-lewy (0,14): ściana lewa wysoka, frontowa niska', () => {
    const bands = wallBands(OFFICE_LAYOUT, { x: 0, y: 14 });
    expect(bands.find((b) => b.axis === 'x')?.back).toBe(false);
    expect(bands.filter((b) => b.axis === 'y').every((b) => b.back)).toBe(true);
  });

  it('ściana przy drzwiach dochodzi do krawędzi drzwi', () => {
    // (0,9) nad wejściem (0,10): tafla pionowa sięga dolnej krawędzi pola.
    const vertical = wallBands(OFFICE_LAYOUT, { x: 0, y: 9 }).find((b) => b.axis === 'y');
    expect(vertical?.rect.y).toBe(9);
    expect(vertical && vertical.rect.y + vertical.rect.height).toBe(10);
    // (2,5) na lewo od drzwi (3,5): tafla pozioma sięga prawej krawędzi pola.
    const horizontal = wallBands(OFFICE_LAYOUT, { x: 2, y: 5 }).find((b) => b.axis === 'x');
    expect(horizontal?.rect.x).toBe(2);
    expect(horizontal && horizontal.rect.x + horizontal.rect.width).toBe(3);
  });

  it('podłoga pokoju nie ma tafli ani ćwiartek', () => {
    expect(wallBands(OFFICE_LAYOUT, { x: 8, y: 10 })).toEqual([]);
    expect(wallFloorQuarters(OFFICE_LAYOUT, { x: 8, y: 10 })).toEqual([]);
  });

  it('drzwi: podłoga pokojów po obu stronach i wąski próg w linii ściany', () => {
    // Drzwi wewnętrzne (3,5) w poziomej ścianie działowej — próg wzdłuż X.
    expect(doorThreshold(OFFICE_LAYOUT, { x: 3, y: 5 })).toEqual({
      x: 3,
      y: 5 + low,
      width: 1,
      height: t,
    });
    expect(wallFloorQuarters(OFFICE_LAYOUT, { x: 3, y: 5 }).map((q) => q.room.id)).toEqual([
      'small',
      'small',
      'main',
      'main',
    ]);
    // Wejście (0,10) w lewej ścianie — próg wzdłuż Y, od zewnątrz bez podłogi.
    expect(doorThreshold(OFFICE_LAYOUT, { x: 0, y: 10 })?.height).toBe(1);
    expect(doorThreshold(OFFICE_LAYOUT, { x: 0, y: 10 })?.width).toBe(t);
    expect(wallFloorQuarters(OFFICE_LAYOUT, { x: 0, y: 10 })).toHaveLength(2);
    expect(doorThreshold(OFFICE_LAYOUT, { x: 8, y: 10 })).toBeNull();
  });

  it('ściana między pokojami: ćwiartki z obu stron dostają podłogę właściwego pokoju', () => {
    // (6,2): ściana działowa między gabinetem (z lewej) a pokojem relaksu (z prawej).
    const quarters = wallFloorQuarters(OFFICE_LAYOUT, { x: 6, y: 2 });
    expect(quarters.map((q) => [q.rect.x, q.room.id])).toEqual([
      [6, 'small'],
      [6.5, 'social'],
      [6, 'small'],
      [6.5, 'social'],
    ]);
  });

  it('ściana zewnętrzna: ćwiartki od zewnątrz biura zostają puste', () => {
    const quarters = wallFloorQuarters(OFFICE_LAYOUT, { x: 3, y: 0 });
    expect(quarters.every((q) => q.rect.y === 0.5 && q.room.id === 'small')).toBe(true);
    expect(quarters).toHaveLength(2);
  });
});
