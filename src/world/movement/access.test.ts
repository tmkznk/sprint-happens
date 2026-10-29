import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../../domain/config';
import type { Furniture, FurnitureId } from '../../domain/furniture';
import { createInitialState } from '../../domain/state';
import { OFFICE_LAYOUT } from '../officeLayout';
import { validateAccess } from './access';

const starting = Object.values(createInitialState(DEFAULT_BALANCE, 1).world.furniture);
const extra = (origin: { x: number; y: number }, type: Furniture['type'] = 'desk'): Furniture => ({
  id: 'furniture-99' as FurnitureId,
  type,
  origin,
  rotation: 0,
});

describe('validateAccess', () => {
  it('startowe wyposażenie nie narusza dostępu', () => {
    expect(validateAccess(OFFICE_LAYOUT, starting)).toEqual([]);
  });

  it('wykrywa zastawione drzwi', () => {
    // Biurko 3×2 w gabinecie zasłaniające pole za drzwiami z open space (3,5).
    const violations = validateAccess(OFFICE_LAYOUT, [...starting, extra({ x: 1, y: 3 })]);

    expect(violations).toContainEqual({ code: 'doorBlocked', cell: { x: 3, y: 5 } });
  });

  it('wykrywa punkt korzystania odcięty od wejścia', () => {
    // Ekspres w kącie, którego punkt korzystania zamyka biurko.
    const coffee = {
      ...extra({ x: 1, y: 11 }, 'coffeeMachine'),
      id: 'furniture-98' as FurnitureId,
    };
    const wall = extra({ x: 1, y: 12 });
    const violations = validateAccess(OFFICE_LAYOUT, [...starting, coffee, wall]);

    expect(violations.some((v) => v.code === 'interactionPointUnreachable')).toBe(true);
  });

  it('wykrywa punkt korzystania, który jest jedynym przejściem do innych wymaganych pól', () => {
    // Biurko w gabinecie: jego punkt korzystania (3,4) leży tuż za drzwiami (3,5),
    // więc osoba przy biurku odcina ekspres w głębi pokoju.
    const blocker = extra({ x: 2, y: 2 });
    const coffee = {
      ...extra({ x: 1, y: 1 }, 'coffeeMachine'),
      id: 'furniture-98' as FurnitureId,
    };
    const violations = validateAccess(OFFICE_LAYOUT, [...starting, blocker, coffee]);

    expect(violations).toContainEqual({
      code: 'interactionPointCutsPassage',
      furnitureId: blocker.id,
      cell: { x: 3, y: 4 },
    });
  });
});
