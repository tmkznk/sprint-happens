import { describe, expect, it } from 'vitest';
import { cellKey, gridFromAscii, sameCell } from './grid';
import {
  createAgent,
  createMovementState,
  DEFAULT_MOVEMENT_CONFIG,
  occupiedCellKeys,
  stepMovement,
  type MovementEnv,
  type MovementState,
} from './movement';
import { SCENARIOS, type Scenario } from './scenarios';

type Trace = { states: MovementState[]; usedBy: Map<string, string[]> };

// Uruchamia scenariusz i sprawdza niezmienniki ruchu po każdym kroku.
function run(scenario: Scenario, steps = scenario.maxSteps): Trace {
  const { env } = scenario;
  const states: MovementState[] = [scenario.initial];
  const usedBy = new Map<string, string[]>();
  let state = scenario.initial;
  for (let i = 0; i < steps; i++) {
    const next = stepMovement(state, env);
    assertInvariants(state, next, env);
    for (const agent of next.agents) {
      if (agent.status === 'using' && agent.reservedDestination) {
        const users = usedBy.get(agent.reservedDestination) ?? [];
        if (users[users.length - 1] !== agent.id) users.push(agent.id);
        usedBy.set(agent.reservedDestination, users);
      }
    }
    states.push(next);
    state = next;
    if (scenario.expect === 'allArrive' && allArrived(state)) break;
  }
  return { states, usedBy };
}

function assertInvariants(previous: MovementState, next: MovementState, env: MovementEnv) {
  const taken = new Map<string, string>();
  for (const agent of next.agents) {
    for (const key of occupiedCellKeys(agent)) {
      // MOVE-04: nigdy dwie osoby na jednym polu.
      expect(taken.get(key), `pole ${key} w kroku ${next.step}`).toBeUndefined();
      taken.set(key, agent.id);
    }
    expect(env.grid.passable(agent.cell), `${agent.id} na przeszkodzie`).toBe(true);
    const before = previous.agents.find((a) => a.id === agent.id);
    if (before && !sameCell(before.cell, agent.cell)) {
      // Pole logiczne zmienia się tylko o jednego sąsiada, po zakończonym przejściu.
      const distance =
        Math.abs(before.cell.x - agent.cell.x) + Math.abs(before.cell.y - agent.cell.y);
      expect(distance, `${agent.id} przeskok w kroku ${next.step}`).toBe(1);
      expect(sameCell(before.move?.to ?? before.cell, agent.cell)).toBe(true);
    }
  }
  // MOVE-03: miejsce korzystania ma najwyżej jedną rezerwację.
  const holders = Object.values(next.reservations);
  expect(new Set(holders).size).toBe(holders.length);
}

function allArrived(state: MovementState): boolean {
  return state.agents.every(
    (agent) => agent.tasks.length === 1 && agent.status === 'arrived' && !agent.move,
  );
}

describe('scenariusze ruchu', () => {
  for (const scenario of SCENARIOS.filter((s) => s.expect === 'allArrive')) {
    it(`${scenario.name}: ${scenario.description}`, () => {
      const { states } = run(scenario);
      const final = states[states.length - 1];
      expect(final && allArrived(final), `nie wszyscy dotarli w ${scenario.maxSteps} krokach`).toBe(
        true,
      );
    });
  }

  it('blockedLine: osoba bez drogi dostaje jawny status blokady, druga dociera', () => {
    const scenario = SCENARIOS.find((s) => s.name === 'blockedLine');
    if (!scenario) throw new Error('brak scenariusza');
    const final = run(scenario).states.at(-1);

    expect(final?.agents.find((a) => a.id === 'A')?.status).toBe('deadlocked');
    expect(final?.agents.find((a) => a.id === 'B')?.status).toBe('arrived');
  });

  it('impossible: blokada bez wolnego pola jest jawnie rozpoznana, a nie pomijana', () => {
    const scenario = SCENARIOS.find((s) => s.name === 'impossible');
    if (!scenario) throw new Error('brak scenariusza');
    const { states } = run(scenario);
    const final = states[states.length - 1];

    expect(final?.agents.map((agent) => agent.status)).toEqual(['deadlocked', 'deadlocked']);
    expect(final?.agents.map((agent) => cellKey(agent.cell))).toEqual(['1,1', '2,1']);
  });

  it('coffee: ekspres obsługuje jedną osobę naraz, w kolejności zgłoszeń', () => {
    const scenario = SCENARIOS.find((s) => s.name === 'coffee');
    if (!scenario) throw new Error('brak scenariusza');

    expect(run(scenario).usedBy.get('1')).toEqual(['A', 'B', 'C']);
  });

  it('sofa: dwa miejsca kanapy są używane równocześnie przez różne osoby', () => {
    const scenario = SCENARIOS.find((s) => s.name === 'sofa');
    if (!scenario) throw new Error('brak scenariusza');
    const { states, usedBy } = run(scenario);

    const together = states.some(
      (state) => state.agents.filter((agent) => agent.status === 'using').length === 2,
    );
    expect(together).toBe(true);
    expect(states.every((s) => s.agents.filter((a) => a.status === 'using').length <= 2)).toBe(
      true,
    );
    expect([...(usedBy.get('1') ?? []), ...(usedBy.get('2') ?? [])].sort()).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('jest deterministyczny: ten sam scenariusz daje identyczny przebieg', () => {
    for (const scenario of SCENARIOS) {
      expect(JSON.stringify(run(scenario).states)).toBe(JSON.stringify(run(scenario).states));
    }
  });

  it('stan ruchu przetrwa serializację JSON w połowie scenariusza', () => {
    const scenario = SCENARIOS.find((s) => s.name === 'three');
    if (!scenario) throw new Error('brak scenariusza');
    const { states } = run(scenario);
    const middle = states[Math.floor(states.length / 2)];
    if (!middle) throw new Error('brak stanu');

    let restored = JSON.parse(JSON.stringify(middle)) as MovementState;
    let original = middle;
    for (let i = 0; i < 50; i++) {
      restored = stepMovement(restored, scenario.env);
      original = stepMovement(original, scenario.env);
    }
    expect(restored).toEqual(original);
  });
});

describe('stepMovement', () => {
  const { grid, points } = gridFromAscii(['#######', '#A...a#', '#.....#', '#######']);
  const env: MovementEnv = { grid, destinations: [], config: DEFAULT_MOVEMENT_CONFIG };
  const point = (key: string) => points[key] ?? { x: 0, y: 0 };

  it('przejście pola trwa stepsPerCell kroków; pole docelowe jest trzymane od startu', () => {
    let state = createMovementState([
      createAgent('A', point('A'), [{ kind: 'goTo', cell: point('a') }]),
    ]);
    state = stepMovement(state, env);
    const agent = state.agents[0];

    expect(agent?.move?.to).toEqual({ x: 2, y: 1 });
    expect(agent && occupiedCellKeys(agent)).toEqual(['1,1', '2,1']);
    for (let i = 0; i < DEFAULT_MOVEMENT_CONFIG.stepsPerCell; i++) state = stepMovement(state, env);
    expect(state.agents[0]?.cell).toEqual({ x: 2, y: 1 });
  });

  it('zgłasza brak trasy do nieosiągalnego celu (bez teleportacji)', () => {
    const state = stepMovement(
      createMovementState([createAgent('A', point('A'), [{ kind: 'goTo', cell: { x: 0, y: 0 } }])]),
      env,
    );

    expect(state.agents[0]?.status).toBe('noRoute');
    expect(state.agents[0]?.cell).toEqual(point('A'));
  });

  it('MOVE-06: zmiana mapy unieważnia trasę i wymusza nową', () => {
    let state = createMovementState([
      createAgent('A', point('A'), [{ kind: 'goTo', cell: point('a') }]),
    ]);
    state = stepMovement(state, env);
    const blockedCell = { x: 3, y: 1 };
    const changed: MovementEnv = {
      ...env,
      grid: { ...grid, passable: (cell) => !sameCell(cell, blockedCell) && grid.passable(cell) },
    };
    for (let i = 0; i < 60; i++) state = stepMovement(state, changed);

    const agent = state.agents[0];
    expect(agent?.status).toBe('arrived');
    expect(agent?.cell).toEqual(point('a'));
  });

  it('przesuwa stojącą bezczynną osobę, która blokuje jedyne przejście', () => {
    const corridor = gridFromAscii(['#######', '#A.I.a#', '###.###', '#######']);
    const corridorEnv: MovementEnv = {
      grid: corridor.grid,
      destinations: [],
      config: DEFAULT_MOVEMENT_CONFIG,
    };
    let state = createMovementState([
      createAgent('A', corridor.points.A ?? { x: 0, y: 0 }, [
        { kind: 'goTo', cell: corridor.points.a ?? { x: 0, y: 0 } },
      ]),
      createAgent('I', corridor.points.I ?? { x: 0, y: 0 }),
    ]);
    for (let i = 0; i < 100; i++) state = stepMovement(state, corridorEnv);

    expect(state.agents.find((a) => a.id === 'A')?.status).toBe('arrived');
  });
});
