import { describe, expect, it } from 'vitest';
import {
  CHARACTER_RING_DEPTH,
  CHARACTER_SHADOW_DEPTH,
  cellAtScreen,
  cellCenter,
  depthOfFootprint,
  depthOfPoint,
  gridToScreen,
  interpolate,
  screenToGrid,
} from './projection';

describe('projection', () => {
  it('znacznik pod stopami leży nad cieniem i pod każdym obiektem biura', () => {
    expect(CHARACTER_RING_DEPTH).toBeGreaterThan(CHARACTER_SHADOW_DEPTH);
    // Najniższy punkt świata: dojście na zewnątrz biura (x −2, y 10).
    expect(CHARACTER_RING_DEPTH).toBeLessThan(depthOfPoint({ x: -2, y: 10 }));
    expect(CHARACTER_RING_DEPTH).toBeLessThan(
      depthOfFootprint({ x: 0, y: 0 }, { width: 1, height: 1 }),
    );
  });

  it('rzutuje według ART-04: screenX = (x−y)·32, screenY = (x+y)·16', () => {
    expect(gridToScreen({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(gridToScreen({ x: 1, y: 0 })).toEqual({ x: 32, y: 16 });
    expect(gridToScreen({ x: 0, y: 1 })).toEqual({ x: -32, y: 16 });
    expect(gridToScreen({ x: 3, y: 2 })).toEqual({ x: 32, y: 80 });
  });

  it('przekształcenie odwrotne zwraca punkt siatki', () => {
    for (const point of [
      { x: 0, y: 0 },
      { x: 4.25, y: 7.5 },
      { x: 18, y: 13 },
    ]) {
      const back = screenToGrid(gridToScreen(point));
      expect(back.x).toBeCloseTo(point.x);
      expect(back.y).toBeCloseTo(point.y);
    }
  });

  it('wskazuje pole pod środkiem pola i pod jego narożnikami (wewnątrz rombu)', () => {
    const cell = { x: 5, y: 3 };
    expect(cellAtScreen(gridToScreen(cellCenter(cell)))).toEqual(cell);
    expect(cellAtScreen(gridToScreen({ x: 5.05, y: 3.05 }))).toEqual(cell);
    expect(cellAtScreen(gridToScreen({ x: 5.95, y: 3.95 }))).toEqual(cell);
  });

  it('interpoluje liniowo i ogranicza alfę do [0, 1]', () => {
    const a = { x: 1, y: 1 };
    const b = { x: 2, y: 1 };
    expect(interpolate(a, b, 0.25)).toEqual({ x: 1.25, y: 1 });
    expect(interpolate(a, b, -1)).toEqual(a);
    expect(interpolate(a, b, 2)).toEqual(b);
  });

  it('postać przed obiektem ma większą głębokość niż obiekt, a za nim — mniejszą', () => {
    const desk = depthOfFootprint({ x: 2, y: 2 }, { width: 3, height: 2 });
    expect(depthOfPoint(cellCenter({ x: 3, y: 4 }))).toBeGreaterThan(desk);
    expect(depthOfPoint(cellCenter({ x: 3, y: 1 }))).toBeLessThan(desk);
  });

  it('obiekt stojący tuż przed biurkiem jest bliżej kamery (brak remisu)', () => {
    const desk = depthOfFootprint({ x: 2, y: 2 }, { width: 3, height: 2 });
    const coffeeInFront = depthOfFootprint({ x: 3, y: 4 }, { width: 1, height: 1 });

    expect(coffeeInFront).toBeGreaterThan(desk);
  });
});
