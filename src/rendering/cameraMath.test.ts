import { describe, expect, it } from 'vitest';
import {
  centerOn,
  clampCenter,
  fitZoom,
  pan,
  screenToWorld,
  zoomAround,
  type CameraView,
} from './cameraMath';

const view: CameraView = { scrollX: 0, scrollY: 0, zoom: 1, width: 400, height: 800 };

describe('cameraMath', () => {
  it('przy zoomie 1 punkt ekranu to punkt świata przesunięty o scroll', () => {
    expect(screenToWorld({ ...view, scrollX: 10, scrollY: 20 }, { x: 5, y: 5 })).toEqual({
      x: 15,
      y: 25,
    });
  });

  it('przesunięcie palcem przesuwa świat razem z palcem, z uwzględnieniem zoomu', () => {
    const zoomed = { ...view, zoom: 2 };
    const before = screenToWorld(zoomed, { x: 100, y: 100 });

    const after = screenToWorld(pan(zoomed, 30, -10), { x: 130, y: 90 });

    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('zoom zachowuje punkt świata pod palcami', () => {
    const focus = { x: 300, y: 100 };
    const before = screenToWorld(view, focus);

    const zoomed = zoomAround(view, 2, focus, 0.1, 4);

    expect(zoomed.zoom).toBe(2);
    const after = screenToWorld(zoomed, focus);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('ogranicza zoom do zakresu', () => {
    expect(zoomAround(view, 100, { x: 0, y: 0 }, 0.5, 3).zoom).toBe(3);
    expect(zoomAround(view, 0.001, { x: 0, y: 0 }, 0.5, 3).zoom).toBe(0.5);
  });

  it('utrzymuje środek widoku w granicach biura', () => {
    const bounds = { left: -100, top: 0, right: 100, bottom: 200 };
    const far = centerOn(view, { x: 5000, y: -5000 });

    const clamped = clampCenter(far, bounds);

    expect(clamped.scrollX + view.width / 2).toBe(100);
    expect(clamped.scrollY + view.height / 2).toBe(0);
  });

  it('dopasowuje zoom do węższego wymiaru', () => {
    expect(fitZoom(view, { left: 0, top: 0, right: 800, bottom: 400 }, 1)).toBe(0.5);
  });
});
