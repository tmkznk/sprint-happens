import { describe, expect, it } from 'vitest';
import { ROTATIONS, type Furniture, type FurnitureId, type Rotation } from '../domain/furniture';
import { interactionCells, occupiedCells, standingCells } from './geometry';
import { validateAccess } from './movement/access';
import { destinationsOf } from './movement/officeEnv';
import { CHAPTER_TWO_LAYOUT, cellKindAt, roomAt } from './officeLayout';

// SH-052: stół konferencyjny 4×2 — 8 miejsc siedzących na dłuższych bokach i 8 stojących
// (krótsze boki i narożniki). Krzesła stoją na polach miejsc siedzących, jak krzesło biurka.
const table = (x: number, y: number, rotation: Rotation = 0): Furniture => ({
  id: 'furniture-1' as FurnitureId,
  type: 'conferenceTable',
  origin: { x, y },
  rotation,
});
const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;

describe('stół konferencyjny (SH-052)', () => {
  it.each(ROTATIONS)(
    'obrót %i: 8 miejsc siedzących i 8 stojących, poza blatem, bez powtórzeń',
    (rotation) => {
      const item = table(10, 10, rotation);
      const top = new Set(occupiedCells(item).map(key));
      expect(top.size).toBe(8);
      const seats = interactionCells(item).map(key);
      const standing = standingCells(item).map(key);
      expect(seats).toHaveLength(8);
      expect(standing).toHaveLength(8);
      const all = [...seats, ...standing];
      expect(new Set(all).size).toBe(16);
      for (const cell of all) expect(top.has(cell), cell).toBe(false);
    },
  );

  it('w salce rozdziału 2 wzdłuż (2×4 przy x = 9): miejsca siedzące dostępne, przejście wolne', () => {
    const item = table(9, 1, 90);
    for (const cell of occupiedCells(item))
      expect(roomAt(CHAPTER_TWO_LAYOUT, cell)?.id).toBe('conference');
    for (const cell of interactionCells(item))
      expect(cellKindAt(CHAPTER_TWO_LAYOUT, cell), key(cell)).toBe('floor');
    expect(validateAccess(CHAPTER_TWO_LAYOUT, [item])).toEqual([]);
  });

  it('miejsca stojące są celami ruchu, ale ich zablokowanie nie blokuje ustawienia', () => {
    const item = table(9, 1, 90);
    const ids = destinationsOf([item]).map((d) => d.id);
    expect(ids.filter((id) => id.includes('#stand-'))).toHaveLength(8);
    expect(ids.filter((id) => /#\d+$/.test(id))).toHaveLength(8);
  });
});
