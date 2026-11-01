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
import { gridToScreen } from './projection';
import { roomBounds, roomFitBounds, roomSprite } from './roomSprites';
import { OFFICE_LAYOUT, PROLOGUE_LAYOUT } from '../world/officeLayout';

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

  describe('biuro z tarasem: dopasowanie do samego biura, przesuwanie do tarasu', () => {
    const office = roomSprite(OFFICE_LAYOUT);
    if (!office) throw new Error('brak renderu biura');
    // Render biura sprzed dodania tarasu: 1829×1169, kotwica (915, 230), skala 2.
    const beforeTerrace = { left: -457.5, right: 457, top: -115, bottom: 469.5 };

    it.each([
      [420, 700],
      [1280, 800],
    ])('zoom startowy jak przed dodaniem tarasu (%i×%i)', (width, height) => {
      const screen = { ...view, width, height };
      expect(fitZoom(screen, roomFitBounds(office.meta))).toBeCloseTo(
        fitZoom(screen, beforeTerrace),
        3,
      );
    });

    it('środek widoku startowego to środek biura, nie całej sceny', () => {
      const fit = roomFitBounds(office.meta);
      expect((fit.left + fit.right) / 2).toBeCloseTo(
        (beforeTerrace.left + beforeTerrace.right) / 2,
      );
      expect((fit.top + fit.bottom) / 2).toBeCloseTo(
        (beforeTerrace.top + beforeTerrace.bottom) / 2,
      );
    });

    it('clampCenter dopuszcza środek nad tarasem, który byłby poza prostokątem biura', () => {
      const terrace = gridToScreen({ x: -1.5, y: 17.5 });
      const centered = centerOn(view, terrace);
      const inScene = clampCenter(centered, roomBounds(office.meta));
      expect(inScene.scrollX + view.width / 2).toBe(terrace.x);
      expect(inScene.scrollY + view.height / 2).toBe(terrace.y);
      const inOffice = clampCenter(centered, roomFitBounds(office.meta));
      expect(inOffice.scrollX + view.width / 2).toBeGreaterThan(terrace.x);
    });

    it('prolog nie ma terenu na zewnątrz: dopasowanie to cała scena', () => {
      const prologue = roomSprite(PROLOGUE_LAYOUT);
      if (!prologue) throw new Error('brak renderu prologu');
      expect(roomFitBounds(prologue.meta)).toEqual(roomBounds(prologue.meta));
    });
  });
});
