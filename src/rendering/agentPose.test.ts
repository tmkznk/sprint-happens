import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { EmployeeId } from '../domain/employees';
import { ROTATIONS, type Furniture, type FurnitureId } from '../domain/furniture';
import { createAgent, type Agent } from '../domain/movement';
import type { GameState } from '../domain/state';
import { createEngine } from '../simulation/engine';
import { testState } from '../test/engineFixture';
import { interactionCells, occupiedCells } from '../world/geometry';
import { agentPose, deskChairDepth, deskSeat, rotateSeat } from './agentPose';
import { depthOfFootprint } from './projection';

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
      ...createAgent('a', { x: 4, y: 4 }),
      move: { to: { x: 4, y: 5 }, elapsed: 0 },
    };
    expect(at(state, walking)).toMatchObject({ kind: 'walk', facing: 'py' });
    const back = { ...walking, move: { to: { x: 3, y: 4 }, elapsed: 0 } };
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
      ...createAgent('a', { x: 13, y: 11 }),
      status: 'using',
      reservedDestination: `${SOFA}#0`,
    });
    const right = at(state, {
      ...createAgent('b', { x: 15, y: 11 }),
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
      ...createAgent('a', { x: 17, y: 9 }),
      status: 'using',
      reservedDestination: `${COFFEE}#0`,
    });
    expect(pose).toMatchObject({ kind: 'coffee', facing: 'ny', position: { x: 17.5, y: 9.5 } });
  });

  it('obrót siedziska zgadza się z obrotem pól (rotateOffset)', () => {
    const desk: Furniture = { id: DESK, type: 'desk', origin: { x: 0, y: 0 }, rotation: 90 };
    // Środek pola (1,1) przy 0° → pole (0,1) przy 90° (footprint 2×3).
    expect(rotateSeat({ x: 1.5, y: 1.5 }, desk)).toEqual({ x: 0.5, y: 1.5 });
  });
});
