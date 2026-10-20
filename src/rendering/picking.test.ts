import { describe, expect, it } from 'vitest';
import type { Furniture, FurnitureId } from '../domain/furniture';
import { FURNITURE_STYLE } from './placeholderStyle';
import { createAgent } from '../domain/movement';
import { pickAgent, pickFurniture, pointInPolygon } from './picking';
import { cellCenter, gridToScreen } from './projection';

const desk: Furniture = {
  id: 'furniture-1' as FurnitureId,
  type: 'desk',
  origin: { x: 2, y: 2 },
  rotation: 0,
};
const coffee: Furniture = {
  id: 'furniture-2' as FurnitureId,
  type: 'coffeeMachine',
  origin: { x: 5, y: 5 },
  rotation: 0,
};

describe('pickFurniture', () => {
  it('trafia obiekt dotknięty na jego footprincie', () => {
    expect(pickFurniture(gridToScreen(cellCenter({ x: 3, y: 2 })), [desk, coffee])).toBe(desk.id);
  });

  it('trafia wysoki obiekt dotknięty w jego górną część, ponad podłogą za nim', () => {
    const top = gridToScreen({ x: 5.5, y: 5.5 });
    const nearTop = { x: top.x, y: top.y - FURNITURE_STYLE.coffeeMachine.height + 4 };

    expect(pickFurniture(nearTop, [coffee])).toBe(coffee.id);
  });

  it('zwraca null dla pustej podłogi', () => {
    expect(pickFurniture(gridToScreen(cellCenter({ x: 10, y: 10 })), [desk, coffee])).toBeNull();
  });

  it('przy nakładających się bryłach wybiera bliższą kamerze', () => {
    const front: Furniture = {
      ...coffee,
      id: 'furniture-3' as FurnitureId,
      origin: { x: 3, y: 4 },
    };
    // Punkt na górze ekspresu przed biurkiem pokrywa się z obrysem biurka.
    const point = gridToScreen({ x: 3.5, y: 4.1 });
    const raised = { x: point.x, y: point.y - FURNITURE_STYLE.coffeeMachine.height + 2 };

    expect(pickFurniture(raised, [desk, front])).toBe(front.id);
  });
});

describe('pickAgent', () => {
  const front = createAgent('employee-1', { x: 4, y: 4 });
  const behind = createAgent('employee-2', { x: 3, y: 3 });

  it('trafia postać w jej sylwetkę, także w głowę', () => {
    const feet = gridToScreen(cellCenter({ x: 4, y: 4 }));

    expect(pickAgent(feet, [front], 0, 4)).toBe('employee-1');
    expect(pickAgent({ x: feet.x, y: feet.y - 44 }, [front], 0, 4)).toBe('employee-1');
    expect(pickAgent({ x: feet.x + 30, y: feet.y }, [front], 0, 4)).toBeNull();
  });

  it('przy nakładaniu wybiera postać bliższą kamerze', () => {
    const point = gridToScreen(cellCenter({ x: 4, y: 4 }));

    expect(pickAgent({ x: point.x, y: point.y - 30 }, [behind, front], 0, 4)).toBe('employee-1');
  });

  it('uwzględnia pozycję w trakcie przejścia', () => {
    const walking = { ...front, move: { to: { x: 5, y: 4 }, elapsed: 2 } };
    const halfway = gridToScreen({ x: 5, y: 4.5 });

    expect(pickAgent(halfway, [walking], 0, 4)).toBe('employee-1');
  });
});

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('rozpoznaje punkt wewnątrz i na zewnątrz', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });
});
