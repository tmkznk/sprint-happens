import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { EmployeeId } from '../domain/employees';
import { ROTATIONS, type Furniture, type FurnitureId } from '../domain/furniture';
import { createAgent, type Agent } from '../domain/movement';
import type { GameState } from '../domain/state';
import { createEngine } from '../simulation/engine';
import { testState } from '../test/engineFixture';
import { interactionCells, occupiedCells } from '../world/geometry';
import {
  agentPose,
  deskChairDepth,
  deskSeat,
  entranceWall,
  rotateSeat,
  wallVisibility,
  conferenceChairs,
} from './agentPose';
import { depthOfFootprint, gridToScreen, ROOM_FRONT_DEPTH } from './projection';
import { OFFICE_LAYOUT, PROLOGUE_LAYOUT } from '../world/officeLayout';
import type { GridPoint } from '../domain/grid';

const DESK = 'furniture-1' as FurnitureId;
const SOFA = 'furniture-3' as FurnitureId;
const COFFEE = 'furniture-4' as FurnitureId;

// Stan z jednym pracownikiem przy pierwszym biurku (obrót biurka do wyboru).
function withDesk(rotation: Furniture['rotation']): { state: GameState; id: EmployeeId } {
  const engine = createEngine({ config: DEFAULT_BALANCE, initialState: testState() });
  const candidate = engine.getState().staff.candidates[0];
  if (!candidate) throw new Error('brak kandydata');
  engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
  const state = engine.getState();
  const desk = state.world.furniture[DESK];
  if (!desk) throw new Error('brak biurka');
  const id = Object.keys(state.staff.employees)[0] as EmployeeId;
  return {
    state: {
      ...state,
      world: {
        ...state.world,
        furniture: { ...state.world.furniture, [DESK]: { ...desk, rotation } },
      },
    },
    id,
  };
}

const at = (state: GameState, agent: Agent) => agentPose(state, agent, 0, DEFAULT_BALANCE);

describe('poza postaci (prezentacja)', () => {
  it('idąca postać patrzy w stronę przejścia', () => {
    const state = testState();
    const walking = {
      ...createAgent('a', { x: 4, y: 10 }),
      move: { to: { x: 4, y: 11 }, elapsed: 0 },
    };
    expect(at(state, walking)).toMatchObject({ kind: 'walk', facing: 'py' });
    const back = { ...walking, move: { to: { x: 3, y: 10 }, elapsed: 0 } };
    expect(at(state, back)).toMatchObject({ kind: 'walk', facing: 'nx' });
  });

  it.each(ROTATIONS)(
    'przy biurku (obrót %i°) siedzi na krześle w footprincie, przodem do blatu, między krzesłem a blatem',
    (rotation) => {
      const { state, id } = withDesk(rotation);
      const desk = state.world.furniture[DESK] as Furniture;
      const point = interactionCells(desk)[0];
      if (!point) throw new Error('brak punktu');
      const pose = at(state, { ...createAgent(id, point), status: 'arrived' });

      expect(pose.kind).toBe('sitChair');
      const seat = deskSeat(desk);
      expect(pose.position).toEqual(seat);
      const cell = { x: Math.floor(seat.x), y: Math.floor(seat.y) };
      expect(occupiedCells(desk)).toContainEqual(cell);
      // Siedzisko leży między punktem korzystania a resztą biurka: patrzy od punktu w głąb.
      const facing = { 0: 'ny', 90: 'px', 180: 'py', 270: 'nx' }[rotation];
      expect(pose.facing).toBe(facing);
      const chair = deskChairDepth(desk);
      const deskDepth = depthOfFootprint(desk.origin, {
        width: rotation % 180 === 0 ? 3 : 2,
        height: rotation % 180 === 0 ? 2 : 3,
      });
      expect(Math.sign(pose.depth - chair)).toBe(Math.sign(deskDepth - chair));
      expect(Math.abs(pose.depth - chair)).toBeLessThan(Math.abs(deskDepth - chair));
    },
  );

  it('na kanapie siedzi na kolejnych siedziskach, przed oparciem', () => {
    const state = testState();
    const sofa = state.world.furniture[SOFA] as Furniture;
    const left = at(state, {
      ...createAgent('a', { x: 8, y: 3 }),
      status: 'using',
      reservedDestination: `${SOFA}#0`,
    });
    const right = at(state, {
      ...createAgent('b', { x: 10, y: 3 }),
      status: 'using',
      reservedDestination: `${SOFA}#1`,
    });
    expect(left).toMatchObject({ kind: 'sitSofa', facing: 'py' });
    expect(right.position.x).toBeGreaterThan(left.position.x);
    expect(left.depth).toBeGreaterThan(depthOfFootprint(sofa.origin, { width: 3, height: 2 }));
  });

  it('przy ekspresie stoi zwrócona do maszyny', () => {
    const state = testState();
    const pose = at(state, {
      ...createAgent('a', { x: 12, y: 2 }),
      status: 'using',
      reservedDestination: `${COFFEE}#0`,
    });
    expect(pose).toMatchObject({ kind: 'coffee', facing: 'ny', position: { x: 12.5, y: 2.5 } });
  });

  it('obrót siedziska zgadza się z obrotem pól (rotateOffset)', () => {
    const desk: Furniture = { id: DESK, type: 'desk', origin: { x: 0, y: 0 }, rotation: 90 };
    // Środek pola (1,1) przy 0° → pole (0,1) przy 90° (footprint 2×3).
    expect(rotateSeat({ x: 1.5, y: 1.5 }, desk)).toEqual({ x: 0.5, y: 1.5 });
  });

  it('stojący na miejscu terrace#: kind smoke, facing py', () => {
    const pose = at(testState(), {
      ...createAgent('a', { x: 2, y: 16 }),
      status: 'using',
      reservedDestination: 'terrace#3',
    });
    expect(pose).toMatchObject({
      kind: 'smoke',
      facing: 'py',
      position: { x: 2.5, y: 16.5 },
      alpha: 1,
    });
  });

  it('postać na tarasie ma głębokość powyżej ROOM_FRONT_DEPTH, w biurze poniżej', () => {
    const state = testState();
    const smoking = at(state, {
      ...createAgent('a', { x: 2, y: 16 }),
      status: 'using',
      reservedDestination: 'terrace#3',
    });
    expect(smoking.depth).toBeGreaterThan(ROOM_FRONT_DEPTH);
    const walkingOut = at(state, {
      ...createAgent('b', { x: -1, y: 15 }),
      move: { to: { x: 0, y: 15 }, elapsed: 0 },
    });
    expect(walkingOut.depth).toBeGreaterThan(ROOM_FRONT_DEPTH);
    const inOffice = at(state, createAgent('c', { x: 4, y: 12 }));
    expect(inOffice.depth).toBeLessThan(ROOM_FRONT_DEPTH);
    // Bliżej kamery na tarasie nadal znaczy wyżej.
    const front = at(state, createAgent('d', { x: 2, y: 17 }));
    expect(front.depth).toBeGreaterThan(smoking.depth);
  });

  const WALL = entranceWall(OFFICE_LAYOUT);
  const wallVisibilityAt = (point: GridPoint) => wallVisibility(point, WALL);

  it('w biurze postać jest w pełni widoczna, a na dojściu za ścianą (z dala od drzwi) znika', () => {
    const state = testState();
    expect(at(state, createAgent('a', { x: 4, y: 12 })).alpha).toBe(1);
    expect(at(state, createAgent('b', { x: -1, y: 12 })).alpha).toBe(0);
    expect(at(state, createAgent('c', { x: -1, y: 15 })).alpha).toBe(1);
    // Pole przed drzwiami: w pełni w biurze, bez przycięcia.
    expect(at(state, createAgent('e', { x: 1, y: 10 }))).toMatchObject({ alpha: 1, clip: null });
    // Tuż przed drzwiami (przed licem ościeżnicy): bez przycięcia — postać mieści się pod nadprożem.
    expect(wallVisibilityAt({ x: 0.7, y: 10.5 })).toEqual({ alpha: 1, clip: null });
  });

  it('entranceWall: drzwi i koniec wysokiej ściany x = 0 (misja i prolog)', () => {
    expect(WALL).toEqual({ doorY: 10, endY: 14.61 });
    expect(entranceWall(PROLOGUE_LAYOUT)).toEqual({ doorY: 4, endY: 6.61 });
  });

  it('wallVisibility: biuro i taras w pełni widoczne, bez przycięcia', () => {
    for (const point of [
      { x: 5.5, y: 9.5 },
      { x: 1.5, y: 10.5 },
      { x: 3.5, y: 16.5 },
      { x: -0.5, y: 15.5 },
    ]) {
      expect(wallVisibility(point, WALL)).toEqual({ alpha: 1, clip: null });
    }
  });

  it('wallVisibility: w drzwiach — nieprzezroczysta, przycięta do prześwitu i nadproża', () => {
    const inDoorway = wallVisibility({ x: 0.5, y: 10.5 }, WALL);
    expect(inDoorway.alpha).toBe(1);
    const clip = inDoorway.clip;
    expect(clip).not.toBeNull();
    // Prześwit ościeżnicy (1,0 m): szerokość ok. 33 px świata wokół kolumny drzwi (x − y = −10).
    expect((clip?.right ?? 0) - (clip?.left ?? 0)).toBeCloseTo(33.1, 0);
    expect(clip?.left).toBeLessThan(gridToScreen({ x: 0.5, y: 10.5 }).x);
    expect(clip?.right).toBeGreaterThan(gridToScreen({ x: 0.5, y: 10.5 }).x);
    // Nadproże (przednia krawędź, 2,30 m) wyżej niż najwyższa postać (~1,96 m ≈ 103 px).
    expect(clip?.top).toBeLessThan(gridToScreen({ x: 0.5, y: 10.5 }).y - 105);
    // Pole za drzwiami na wprost nich: kamera patrzy przez otwór w prawo i w głąb, więc postać
    // zasłania lewy słupek i ściana.
    expect(wallVisibility({ x: -0.5, y: 10.5 }, WALL).alpha).toBe(0);
    // Za drzwiami, ale w prawo (w stronę mniejszego y) — widoczna przez prześwit.
    expect(wallVisibility({ x: -0.3, y: 9.6 }, WALL)).toMatchObject({ alpha: 1 });
    // Dalej za ścianą, poza otworem — niewidoczna.
    expect(wallVisibility({ x: -0.5, y: 12.5 }, WALL).alpha).toBe(0);
    // Bez opisu ściany (inny układ) — bez zmian.
    expect(wallVisibility({ x: -0.5, y: 12.5 }, null)).toEqual({ alpha: 1, clip: null });
  });

  it('wallVisibility: przy końcu ściany postać wychodzi zza rogu — przycięcie na krawędzi', () => {
    const corner = gridToScreen({ x: 0.39, y: 14.61 }).x;
    const behind = wallVisibility({ x: -0.5, y: 14.2 }, WALL);
    expect(behind.clip?.right).toBeCloseTo(corner);
    expect(behind.clip?.left).toBe(-Infinity);
    // Część sylwetki wystaje już zza krawędzi — widoczna (przycięta), nie przezroczysta.
    expect(behind.alpha).toBe(1);
    // Przed końcem ściany (w y) — bez przycięcia.
    expect(wallVisibility({ x: -0.5, y: 14.7 }, WALL)).toEqual({ alpha: 1, clip: null });
  });
});

describe('stół konferencyjny (SH-052)', () => {
  const TABLE = 'furniture-9' as FurnitureId;
  function withTable(rotation: Furniture['rotation']): GameState {
    const state = testState();
    const table: Furniture = {
      id: TABLE,
      type: 'conferenceTable',
      origin: { x: 8, y: 9 },
      rotation,
    };
    return {
      ...state,
      world: { ...state.world, furniture: { ...state.world.furniture, [TABLE]: table } },
    };
  }

  it.each(ROTATIONS)(
    'obrót %i: na miejscu siedzącym postać siedzi na krześle przodem do stołu',
    (rotation) => {
      const state = withTable(rotation);
      const table = state.world.furniture[TABLE];
      if (!table) throw new Error('setup');
      interactionCells(table).forEach((cell, index) => {
        const pose = at(state, {
          ...createAgent('a', cell),
          status: 'using',
          reservedDestination: `${TABLE}#${index}`,
        });
        expect(pose.kind).toBe('sitChair');
        // Przodem do boku obrysu stołu, przy którym stoi krzesło (także krzesła skrajne).
        const turned = rotation === 90 || rotation === 270;
        const w = turned ? 2 : 4;
        const h = turned ? 4 : 2;
        const toward =
          cell.y < 9
            ? 'py'
            : cell.y >= 9 + h
              ? 'ny'
              : cell.x < 8
                ? 'px'
                : cell.x >= 8 + w
                  ? 'nx'
                  : null;
        expect(pose.facing, `${index}`).toBe(toward);
      });
    },
  );

  it('na miejscu stojącym postać stoi zwrócona do stołu', () => {
    const state = withTable(0);
    const pose = at(state, {
      ...createAgent('a', { x: 7, y: 9 }),
      status: 'using',
      reservedDestination: `${TABLE}#stand-0`,
    });
    expect(pose).toMatchObject({ kind: 'idle', facing: 'px' });
  });
});

describe('stół konferencyjny — kolejność rysowania (SH-052)', () => {
  it.each(ROTATIONS)(
    'obrót %i: krzesła po dalszej stronie pod blatem, po bliższej nad nim',
    (rotation) => {
      const table: Furniture = {
        id: 'furniture-9' as FurnitureId,
        type: 'conferenceTable',
        origin: { x: 8, y: 9 },
        rotation,
      };
      const turned = rotation === 90 || rotation === 270;
      const size = turned ? { width: 2, height: 4 } : { width: 4, height: 2 };
      const tableDepth = depthOfFootprint(table.origin, size);
      for (const chair of conferenceChairs(table)) {
        const far = chair.cell.x < table.origin.x || chair.cell.y < table.origin.y;
        if (far) expect(chair.depth, `${chair.cell.x},${chair.cell.y}`).toBeLessThan(tableDepth);
        else expect(chair.depth, `${chair.cell.x},${chair.cell.y}`).toBeGreaterThan(tableDepth);
      }
    },
  );
});
