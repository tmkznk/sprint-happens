import { describe, expect, it } from 'vitest';
import { PEOPLE } from '../domain/content/people';
import {
  CHARACTER_SHEET,
  SMOKE_SHEET,
  shownPoseKind,
  sheetOf,
  sheetOrigin,
} from './characterSheets';

describe('arkusze postaci', () => {
  it('przed załadowaniem atlasu palenia pokazuje idle, potem smoke', () => {
    expect(shownPoseKind('smoke', false)).toBe('idle');
    expect(shownPoseKind('smoke', true)).toBe('smoke');
  });

  it('pozostałe pozy są niezależne od atlasu palenia', () => {
    for (const ready of [false, true]) {
      expect(shownPoseKind('walk', ready)).toBe('walk');
      expect(shownPoseKind('coffee', ready)).toBe('coffee');
      expect(shownPoseKind('idle', ready)).toBe('idle');
    }
  });

  it('atlas palenia ma własną ramkę i kotwicę: stopy w tym samym punkcie klatki', () => {
    expect(SMOKE_SHEET).toMatchObject({
      frameWidth: 97,
      frameHeight: 147,
      anchorX: 34,
      anchorY: 118,
    });
    expect(SMOKE_SHEET.anims.smoke).toEqual({ start: 0, frames: 6, fps: 4 });
    expect(sheetOf('smoke')).toBe(SMOKE_SHEET);
    expect(sheetOf('walk')).toBe(CHARACTER_SHEET);
    expect(sheetOf('idle')).toBe(CHARACTER_SHEET);
  });

  it('origin × rozmiar klatki trafia dokładnie w kotwicę (stopy na polu) dla obu arkuszy', () => {
    for (const kind of ['walk', 'smoke'] as const) {
      const sheet = sheetOf(kind);
      const origin = sheetOrigin(kind);
      expect(origin.x * sheet.frameWidth).toBeCloseTo(sheet.anchorX, 9);
      expect(origin.y * sheet.frameHeight).toBeCloseTo(sheet.anchorY, 9);
    }
  });

  it('atlasy palenia tylko dla palaczy, komplet', () => {
    const atlases = Object.keys(import.meta.glob('../assets/characters/smoke/*.webp'))
      .map((path) => path.replace(/^.*\/(.+)\.webp$/, '$1'))
      .sort();
    const smokers = PEOPLE.filter((person) => person.cigarettesPerDay > 0)
      .map((person) => person.id as string)
      .sort();
    expect(atlases).toEqual(smokers);
    expect(atlases).toHaveLength(16);
  });
});
