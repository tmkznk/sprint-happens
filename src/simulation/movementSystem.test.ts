import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { Furniture, FurnitureId } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import { createAgent, createMovementState, type Agent, type Task } from '../domain/movement';
import { createInitialState, type GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { cellKey } from '../world/movement/grid';
import { occupiedCellKeys, removeAgent } from '../world/movement/movement';
import { destinationId, movementEnvFor } from '../world/movement/officeEnv';
import { createEngine } from './engine';

const DESK = 'furniture-1' as FurnitureId;
const COFFEE = 'furniture-4' as FurnitureId;

function stateWith(agents: Agent[], patch: (state: GameState) => GameState = (s) => s): GameState {
  const initial = createInitialState(DEFAULT_BALANCE, 7);
  return deepFreeze(
    patch({
      ...initial,
      mission: { ...initial.mission, speed: 1 },
      world: { ...initial.world, movement: createMovementState(agents) },
    }),
  );
}

function engineFor(state: GameState) {
  return createEngine({ config: DEFAULT_BALANCE, initialState: state });
}

function agent(id: string, cell: GridPoint, tasks: Task[]) {
  return createAgent(id, cell, tasks);
}

function run(engine: ReturnType<typeof engineFor>, steps: number, onStep?: () => void) {
  for (let i = 0; i < steps; i++) {
    engine.step();
    onStep?.();
  }
}

const agentOf = (engine: ReturnType<typeof engineFor>, id: string) =>
  engine.getState().world.movement.agents.find((a) => a.id === id);

describe('ruch w silniku (SH-011)', () => {
  it('trasa po czterech sąsiadach kończy się w punkcie korzystania z biurka', () => {
    const engine = engineFor(
      stateWith([
        agent('employee-1', { x: 5, y: 12 }, [
          { kind: 'use', destinationIds: [destinationId(DESK, 0)], steps: 1000 },
        ]),
      ]),
    );
    const visited: GridPoint[] = [];
    run(engine, 200, () => {
      const current = agentOf(engine, 'employee-1')?.cell;
      if (current && cellKey(current) !== cellKey(visited.at(-1) ?? { x: -1, y: -1 })) {
        visited.push(current);
      }
    });

    expect(agentOf(engine, 'employee-1')).toMatchObject({ cell: { x: 3, y: 4 }, status: 'using' });
    const { grid } = movementEnvFor(engine.getState(), DEFAULT_BALANCE);
    for (const [i, cell] of visited.entries()) {
      expect(grid.passable(cell)).toBe(true);
      const previous = visited[i - 1];
      if (previous) expect(Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y)).toBe(1);
    }
  });

  it('nieosiągalny cel daje jawny status, bez teleportacji', () => {
    const engine = engineFor(
      stateWith([agent('employee-1', { x: 5, y: 12 }, [{ kind: 'goTo', cell: { x: 0, y: 0 } }])]),
    );
    run(engine, 10);

    expect(agentOf(engine, 'employee-1')).toMatchObject({
      status: 'noRoute',
      cell: { x: 5, y: 12 },
    });
  });

  it('pauza zatrzymuje ruch postaci (TIME-T03)', () => {
    const engine = engineFor(
      stateWith(
        [agent('employee-1', { x: 5, y: 12 }, [{ kind: 'goTo', cell: { x: 5, y: 6 } }])],
        (s) => ({
          ...s,
          mission: { ...s.mission, speed: 0 },
        }),
      ),
    );
    const before = engine.getState();
    run(engine, 50);

    expect(engine.getState()).toBe(before);
  });

  it('MOVE-06: nowy mebel na trasie unieważnia ją i postać dociera naokoło', () => {
    const engine = engineFor(
      stateWith([agent('employee-1', { x: 1, y: 6 }, [{ kind: 'goTo', cell: { x: 9, y: 6 } }])]),
    );
    run(engine, 5);
    const midRoute = engine.getState();
    const blocker: Furniture = {
      id: 'furniture-5' as FurnitureId,
      type: 'desk',
      origin: { x: 5, y: 5 },
      rotation: 90,
    };
    const changed = engineFor(
      deepFreeze({
        ...midRoute,
        world: {
          ...midRoute.world,
          furniture: { ...midRoute.world.furniture, [blocker.id]: blocker },
        },
        ids: { ...midRoute.ids, furniture: 5 },
      }),
    );
    run(changed, 200);

    expect(agentOf(changed, 'employee-1')).toMatchObject({
      status: 'arrived',
      cell: { x: 9, y: 6 },
    });
  });
});

describe('rezerwacje i ustępowanie w silniku (SH-012)', () => {
  it('trzy osoby w drzwiach biura: nigdy dwie na jednym polu, wszystkie docierają', () => {
    const engine = engineFor(
      stateWith([
        agent('employee-1', { x: 9, y: 3 }, [{ kind: 'goTo', cell: { x: 15, y: 4 } }]),
        agent('employee-2', { x: 13, y: 3 }, [{ kind: 'goTo', cell: { x: 6, y: 6 } }]),
        agent('employee-3', { x: 9, y: 4 }, [{ kind: 'goTo', cell: { x: 16, y: 2 } }]),
      ]),
    );
    run(engine, 300, () => {
      const keys = engine.getState().world.movement.agents.flatMap(occupiedCellKeys);
      expect(new Set(keys).size).toBe(keys.length);
    });

    expect(engine.getState().world.movement.agents.map((a) => a.status)).toEqual([
      'arrived',
      'arrived',
      'arrived',
    ]);
  });

  it('dwie osoby chcące kawy: jedna korzysta, druga czeka w kolejce', () => {
    const coffee = { kind: 'use', destinationIds: [destinationId(COFFEE, 0)], steps: 30 } as const;
    const engine = engineFor(
      stateWith([
        agent('employee-1', { x: 13, y: 12 }, [coffee]),
        agent('employee-2', { x: 12, y: 12 }, [coffee]),
      ]),
    );
    let together = false;
    run(engine, 300, () => {
      const statuses = engine.getState().world.movement.agents.map((a) => a.status);
      if (statuses.filter((s) => s === 'using').length > 1) together = true;
    });

    expect(together).toBe(false);
    expect(engine.getState().world.movement.agents.map((a) => a.tasks.length)).toEqual([0, 0]);
  });

  it('usunięcie mebla z zarezerwowanym miejscem zwalnia rezerwację', () => {
    const engine = engineFor(
      stateWith([
        agent('employee-1', { x: 13, y: 12 }, [
          { kind: 'use', destinationIds: [destinationId(COFFEE, 0)], steps: 999 },
        ]),
      ]),
    );
    run(engine, 3);
    expect(engine.getState().world.movement.reservations).toEqual({
      [destinationId(COFFEE, 0)]: 'employee-1',
    });

    const state = engine.getState();
    const furniture = Object.fromEntries(
      Object.entries(state.world.furniture).filter(([id]) => id !== COFFEE),
    ) as GameState['world']['furniture'];
    const sold = engineFor(deepFreeze({ ...state, world: { ...state.world, furniture } }));
    run(sold, 1);

    expect(sold.getState().world.movement.reservations).toEqual({});
    expect(agentOf(sold, 'employee-1')).toMatchObject({
      reservedDestination: null,
      status: 'queued',
    });
  });

  it('odejście postaci zwalnia jej rezerwację i pola', () => {
    const engine = engineFor(
      stateWith([
        agent('employee-1', { x: 13, y: 12 }, [
          { kind: 'use', destinationIds: [destinationId(COFFEE, 0)], steps: 999 },
        ]),
      ]),
    );
    run(engine, 3);

    const after = removeAgent(engine.getState().world.movement, 'employee-1');

    expect(after.agents).toEqual([]);
    expect(after.reservations).toEqual({});
  });
});

describe('movementEnvFor', () => {
  it('wyznacza miejsca korzystania z mebli i blokuje ich footprinty', () => {
    const state = createInitialState(DEFAULT_BALANCE, 1);
    const env = movementEnvFor(state, DEFAULT_BALANCE);

    expect(env.destinations.map((d) => d.id)).toEqual([
      'furniture-1#0',
      'furniture-2#0',
      'furniture-3#0',
      'furniture-3#1',
      'furniture-4#0',
    ]);
    expect(env.grid.passable({ x: 3, y: 2 })).toBe(false);
    expect(env.grid.passable({ x: 3, y: 4 })).toBe(true);
  });

  it('nie przelicza mapy, dopóki meble się nie zmienią', () => {
    const state = createInitialState(DEFAULT_BALANCE, 1);

    expect(movementEnvFor(state, DEFAULT_BALANCE).grid).toBe(
      movementEnvFor(state, DEFAULT_BALANCE).grid,
    );
  });
});
