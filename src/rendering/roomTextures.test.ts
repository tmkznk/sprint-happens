import { describe, expect, it } from 'vitest';
import { CHAPTER_TWO_LAYOUT, OFFICE_LAYOUT, PROLOGUE_LAYOUT } from '../world/officeLayout';
import { roomTexturesFor } from './roomSprites';

// Pamięć GPU (CLAUDE.md): scena ładuje tylko pomieszczenie bieżącego układu, nie wszystkie.
describe('roomTexturesFor', () => {
  it.each([
    ['prolog', PROLOGUE_LAYOUT, 'prologue'],
    ['rozdział 1', OFFICE_LAYOUT, 'office'],
    ['rozdział 2', CHAPTER_TWO_LAYOUT, 'chapterTwo'],
  ] as const)('%s: tylko tekstury własnego pomieszczenia', (_, layout, id) => {
    const keys = roomTexturesFor(layout).map(([key]) => key);
    expect(keys).toContain(`room-${id}-back`);
    expect(keys).toContain(`room-${id}-front`);
    expect(keys.every((key) => key.startsWith(`room-${id}-`))).toBe(true);
  });
});
