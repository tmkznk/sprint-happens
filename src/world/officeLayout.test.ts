import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { GridPoint } from '../domain/grid';
import { createInitialState } from '../domain/state';
import { interactionCells, occupiedCells } from './geometry';
import { entryCell } from '../simulation/commute';
import { cellKindAt, OFFICE_LAYOUT, PROLOGUE_LAYOUT, roomAt } from './officeLayout';
import { createAgent, createMovementState, stepMovement } from './movement/movement';
import { movementEnvFor, isSmokingSpotId, smokingSpotIds } from './movement/officeEnv';

const layout = OFFICE_LAYOUT;
const key = (point: GridPoint) => `${point.x},${point.y}`;

describe('OFFICE_LAYOUT', () => {
  // OFF-02: układ i wymiary pokoi to decyzja właściciela (2026-10-29).
  it('ma pokoje o ustalonych wymiarach (open space, gabinet, pokój relaksu)', () => {
    const sizes = Object.fromEntries(
      layout.rooms.map((room) => [room.id, [room.bounds.width, room.bounds.height]]),
    );
    expect(sizes).toEqual({ main: [13, 8], small: [5, 4], social: [7, 4] });
  });

  it('jest otoczone zamkniętą ramą ścian z jednym wejściem', () => {
    const { width, height } = layout.size;
    const border: GridPoint[] = [];
    for (let x = 0; x < width; x++) border.push({ x, y: 0 }, { x, y: height - 1 });
    for (let y = 1; y < height - 1; y++) border.push({ x: 0, y }, { x: width - 1, y });

    const openings = border.filter((point) => cellKindAt(layout, point) !== 'wall');
    expect(openings).toEqual([layout.doors.find((door) => door.isEntrance)?.position]);
  });

  it('każde drzwi łączą dwa obszary przez ścianę', () => {
    for (const door of layout.doors) {
      const { x, y } = door.position;
      const horizontal = [roomAt(layout, { x: x - 1, y }), roomAt(layout, { x: x + 1, y })];
      const vertical = [roomAt(layout, { x, y: y - 1 }), roomAt(layout, { x, y: y + 1 })];
      const sides = horizontal.some(Boolean) ? horizontal : vertical;
      expect(sides.filter(Boolean).length, `drzwi ${key(door.position)}`).toBeGreaterThanOrEqual(
        door.isEntrance ? 1 : 2,
      );
    }
  });

  it('nie ma okien; każde zadeklarowane okno musiałoby leżeć na ścianie', () => {
    expect(layout.windows).toEqual([]);
    for (const window of layout.windows) expect(cellKindAt(layout, window)).toBe('wall');
  });
});

describe('startowe wyposażenie', () => {
  const furniture = Object.values(createInitialState(DEFAULT_BALANCE, 1).world.furniture);

  it('obejmuje dwa biurka, kanapę i ekspres (MIS-01)', () => {
    expect(furniture.map((item) => item.type).sort()).toEqual([
      'coffeeMachine',
      'desk',
      'desk',
      'sofa',
    ]);
  });

  it('stoi na podłodze, w jednym pokoju i bez kolizji', () => {
    const taken = new Set<string>();
    for (const item of furniture) {
      const cells = occupiedCells(item);
      const rooms = new Set(cells.map((cell) => roomAt(layout, cell)?.id));
      expect(rooms.size, item.id).toBe(1);
      for (const cell of cells) {
        expect(cellKindAt(layout, cell), `${item.id} ${key(cell)}`).toBe('floor');
        expect(taken.has(key(cell)), `kolizja ${key(cell)}`).toBe(false);
        taken.add(key(cell));
      }
    }
  });

  it('ma punkty interakcji na wolnej podłodze', () => {
    const taken = new Set(furniture.flatMap(occupiedCells).map(key));
    for (const item of furniture) {
      for (const point of interactionCells(item)) {
        expect(cellKindAt(layout, point), `${item.id} ${key(point)}`).toBe('floor');
        expect(taken.has(key(point)), `${item.id} ${key(point)}`).toBe(false);
      }
    }
  });
});

describe('taras i dojście (outdoor)', () => {
  it('cellKindAt: dojście i taras to outdoor, reszta bez zmian', () => {
    expect(cellKindAt(OFFICE_LAYOUT, { x: -1, y: 10 })).toBe('outdoor');
    expect(cellKindAt(OFFICE_LAYOUT, { x: 7, y: 17 })).toBe('outdoor');
    expect(cellKindAt(OFFICE_LAYOUT, { x: 0, y: 10 })).toBe('door');
    expect(cellKindAt(OFFICE_LAYOUT, { x: 0, y: 11 })).toBe('wall');
    expect(cellKindAt(OFFICE_LAYOUT, { x: 8, y: 16 })).toBeNull();
    expect(OFFICE_LAYOUT.smokingSpots).toHaveLength(17);
    expect(entryCell(OFFICE_LAYOUT)).toEqual({ x: 1, y: 10 });
  });

  it('prolog nie ma terenu zewnętrznego ani miejsc do palenia', () => {
    expect(PROLOGUE_LAYOUT.outdoor).toEqual([]);
    expect(PROLOGUE_LAYOUT.smokingSpots).toEqual([]);
  });

  it('miejsca do palenia mają stabilne ID terrace#n i leżą na tarasie', () => {
    const ids = smokingSpotIds(OFFICE_LAYOUT);
    expect(ids).toHaveLength(17);
    expect(ids[0]).toBe('terrace#0');
    expect(ids.every(isSmokingSpotId)).toBe(true);
    expect(isSmokingSpotId('furniture-1#0')).toBe(false);
    for (const spot of OFFICE_LAYOUT.smokingSpots) {
      expect(cellKindAt(OFFICE_LAYOUT, spot)).toBe('outdoor');
    }
    expect(OFFICE_LAYOUT.smokingSpots).not.toContainEqual({ x: 7, y: 17 });
    const env = movementEnvFor(createInitialState(DEFAULT_BALANCE, 1), DEFAULT_BALANCE);
    for (const [index, spot] of OFFICE_LAYOUT.smokingSpots.entries()) {
      expect(env.destinations).toContainEqual({ id: `terrace#${index}`, cell: spot });
    }
  });

  it('ruch: taras osiągalny z biura wyłącznie przez drzwi wejściowe', () => {
    const { grid } = movementEnvFor(createInitialState(DEFAULT_BALANCE, 1), DEFAULT_BALANCE);
    const seen = new Set<string>([key({ x: 1, y: 10 })]);
    const queue: GridPoint[] = [{ x: 1, y: 10 }];
    while (queue.length > 0) {
      const cell = queue.shift() as GridPoint;
      for (const next of [
        { x: cell.x + 1, y: cell.y },
        { x: cell.x - 1, y: cell.y },
        { x: cell.x, y: cell.y + 1 },
        { x: cell.x, y: cell.y - 1 },
      ]) {
        if (!grid.passable(next) || seen.has(key(next))) continue;
        seen.add(key(next));
        queue.push(next);
      }
    }
    for (const spot of OFFICE_LAYOUT.smokingSpots) expect(seen.has(key(spot))).toBe(true);
    // Jedyne przejście przez lewą ścianę biura (x = 0, y w siatce) to drzwi (0,10).
    const wallCrossings = [...seen].filter((k) => {
      const [x, y] = k.split(',').map(Number);
      return x === 0 && (y as number) < layout.size.height;
    });
    expect(wallCrossings).toEqual(['0,10']);
  });

  it('ruch: 3 wychodzących i 3 wracających mija się w dojściu i drzwiach bez deadlocku', () => {
    const env = movementEnvFor(createInitialState(DEFAULT_BALANCE, 1), DEFAULT_BALANCE);
    const spots = OFFICE_LAYOUT.smokingSpots;
    const inside: GridPoint[] = [
      { x: 3, y: 9 },
      { x: 3, y: 10 },
      { x: 3, y: 11 },
    ];
    const out: GridPoint[] = [spots[0], spots[1], spots[2]] as GridPoint[];
    const agents = [
      ...inside.map((cell, i) =>
        createAgent(`out-${i}`, cell, [{ kind: 'goTo', cell: spots[9 + i] as GridPoint }]),
      ),
      ...out.map((cell, i) =>
        createAgent(`in-${i}`, cell, [{ kind: 'goTo', cell: { x: 5, y: 9 + i } }]),
      ),
    ];
    let state = createMovementState(agents);
    for (let i = 0; i < 1500; i++) state = stepMovement(state, env);
    expect(state.agents.map((a) => a.status)).toEqual(Array(6).fill('arrived'));
  });
});
