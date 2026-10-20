import {
  createAgent,
  createMovementState,
  DEFAULT_MOVEMENT_CONFIG,
  type Agent,
  type AgentStatus,
  type Destination,
  type MovementConfig,
  type MovementState,
  type ReadonlyAgent,
  type ReadonlyMovementState,
  type Task,
} from '../../domain/movement';
import { cellKey, sameCell, type Cell, type MovementGrid } from './grid';
import { findPath } from './pathfinding';

export { createAgent, createMovementState, DEFAULT_MOVEMENT_CONFIG };
export type { Agent, AgentStatus, Destination, MovementConfig, MovementState, Task };

// Ruch bez przenikania (SH-003, SH-011, SH-012). Czyste funkcje: ten sam stan i środowisko
// dają zawsze ten sam wynik.

export type MovementEnv = {
  grid: MovementGrid;
  destinations: readonly Destination[];
  config: MovementConfig;
};

const PUSHABLE: ReadonlySet<AgentStatus> = new Set([
  'idle',
  'arrived',
  'queued',
  'yielding',
  'noRoute',
  'deadlocked',
]);

// SH-012: odejście postaci zwalnia jej pola, rezerwacje i ustąpienia na jej rzecz.
export function removeAgent(state: ReadonlyMovementState, id: string): MovementState {
  return {
    step: state.step,
    agents: state.agents
      .filter((agent) => agent.id !== id)
      .map((agent) => {
        const clone = cloneAgent(agent);
        if (clone.yieldingTo === id) clone.yieldingTo = null;
        return clone;
      }),
    reservations: Object.fromEntries(
      Object.entries(state.reservations).filter(([, holder]) => holder !== id),
    ),
  };
}

// Pola zajęte przez postacie: pole logiczne oraz pole, do którego trwa przejście.
export function occupiedCellKeys(agent: ReadonlyAgent): string[] {
  return agent.move ? [cellKey(agent.cell), cellKey(agent.move.to)] : [cellKey(agent.cell)];
}

export function currentGoal(agent: ReadonlyAgent, env: MovementEnv): Cell | null {
  const task = agent.tasks[0];
  if (!task) return null;
  if (task.kind === 'goTo') return task.cell;
  const destination = env.destinations.find((d) => d.id === agent.reservedDestination);
  return destination?.cell ?? null;
}

export function stepMovement(state: ReadonlyMovementState, env: MovementEnv): MovementState {
  const step = state.step + 1;
  const agents = state.agents.map(cloneAgent);
  let reservations = { ...state.reservations };
  const byIdMap = new Map(agents.map((agent) => [agent.id, agent]));
  const { grid, config } = env;

  // 1. Zakończenie przejść — dopiero teraz zwalnia się pole źródłowe.
  for (const agent of agents) {
    if (!agent.move) continue;
    agent.move.elapsed++;
    if (agent.move.elapsed >= config.stepsPerCell) {
      agent.cell = agent.move.to;
      agent.move = null;
    }
  }

  // SH-012: miejsce, które zniknęło (np. sprzedany lub przeniesiony mebel), zwalnia rezerwację;
  // postać wraca do kolejki po inne miejsce.
  const destinationIds = new Set(env.destinations.map((destination) => destination.id));
  reservations = Object.fromEntries(
    Object.entries(reservations).filter(([id]) => destinationIds.has(id)),
  );
  for (const agent of agents) {
    if (agent.reservedDestination === null || destinationIds.has(agent.reservedDestination))
      continue;
    agent.reservedDestination = null;
    agent.queuedSince = null;
    agent.usedSteps = 0;
    agent.path = [];
    if (agent.status !== 'yielding') agent.status = 'queued';
  }

  // 2. Zadania postaci stojących: kolejka, korzystanie, dotarcie.
  for (const agent of agents) {
    if (agent.move || agent.path.length > 0) continue;
    const task = agent.tasks[0];
    if (!task) {
      if (agent.status !== 'yielding') agent.status = 'idle';
      continue;
    }
    if (task.kind === 'use') {
      if (agent.reservedDestination === null) {
        agent.queuedSince ??= step;
        if (agent.status !== 'yielding') agent.status = 'queued';
        continue;
      }
      const goal = currentGoal(agent, env);
      if (goal && sameCell(goal, agent.cell) && agent.status !== 'yielding') {
        agent.status = 'using';
        agent.usedSteps++;
        if (agent.usedSteps >= task.steps) {
          const released = agent.reservedDestination;
          reservations = Object.fromEntries(
            Object.entries(reservations).filter(([id]) => id !== released),
          );
          agent.tasks.shift();
          agent.reservedDestination = null;
          agent.queuedSince = null;
          agent.usedSteps = 0;
          agent.status = 'idle';
        }
      }
      continue;
    }
    if (sameCell(task.cell, agent.cell) && agent.status !== 'yielding') agent.status = 'arrived';
  }

  // 3. Rezerwacje miejsc w kolejności zgłoszeń (MOVE-03); remis rozstrzyga ID.
  for (const destination of env.destinations) {
    if (reservations[destination.id]) continue;
    const next = agents
      .filter((agent) => {
        const task = agent.tasks[0];
        return (
          task?.kind === 'use' &&
          agent.reservedDestination === null &&
          agent.queuedSince !== null &&
          task.destinationIds.includes(destination.id)
        );
      })
      .sort((a, b) => (a.queuedSince ?? 0) - (b.queuedSince ?? 0) || byId(a, b))[0];
    if (!next) continue;
    reservations[destination.id] = next.id;
    next.reservedDestination = destination.id;
    if (next.status !== 'yielding') next.status = 'walking';
  }

  // 4. Trzymanie pozycji po ustąpieniu — do czasu, aż przepuszczana postać minie naszą trasę.
  for (const agent of agents) {
    if (agent.status !== 'yielding' || agent.move || agent.path.length > 0) continue;
    agent.yieldHeldSteps++;
    const goal = currentGoal(agent, env);
    const route = goal ? findPath(grid, agent.cell, goal) : null;
    const beneficiary = agent.yieldingTo ? byIdMap.get(agent.yieldingTo) : undefined;
    const stillInTheWay =
      beneficiary !== undefined && route !== null && intersects(route, footprintOf(beneficiary));
    if (stillInTheWay && agent.yieldHeldSteps < config.yieldTimeoutSteps) continue;
    agent.yieldingTo = null;
    agent.yieldHeldSteps = 0;
    agent.status = goal ? 'walking' : 'idle';
  }

  // 5. Planowanie tras po statycznej mapie; MOVE-06 — trasa przez nieprzejezdne pole jest unieważniana.
  for (const agent of agents) {
    if (agent.move || agent.status === 'yielding') continue;
    const goal = currentGoal(agent, env);
    if (!goal || sameCell(goal, agent.cell)) {
      agent.path = [];
      continue;
    }
    if (agent.path.length > 0 && agent.path.every((cell) => grid.passable(cell))) continue;
    const path = findPath(grid, agent.cell, goal);
    agent.path = path ?? [];
    agent.status = path ? 'walking' : 'noRoute';
  }

  // 6. Ruch w kolejności pierwszeństwa: wejście na pole tylko, gdy nikt go nie zajmuje (MOVE-04).
  const occupancy = new Map<string, string>();
  for (const agent of agents) {
    for (const key of occupiedCellKeys(agent)) occupancy.set(key, agent.id);
  }
  const contenders = agents
    .filter((agent) => !agent.move && agent.path.length > 0)
    .sort(byPriority);
  for (const agent of contenders) {
    const next = agent.path[0];
    if (!next) continue;
    if (!occupancy.has(cellKey(next))) {
      occupancy.set(cellKey(next), agent.id);
      agent.move = { to: next, elapsed: 0 };
      agent.path.shift();
      agent.waitedSteps = 0;
      if (agent.status !== 'yielding') agent.status = 'walking';
      continue;
    }
    agent.waitedSteps++;
    if (agent.status !== 'yielding') agent.status = 'waiting';
  }

  // 7. Rozwiązywanie blokad: łańcuch oczekujących kończy się postacią w ruchu (czekamy),
  // stojącą postacią (prosimy o ustąpienie albo szukamy trasy naokoło) lub cyklem.
  const resolved = new Set<string>();
  for (const agent of contenders) {
    if (agent.move || resolved.has(agent.id)) continue;
    const chain: Agent[] = [agent];
    let current = agent;
    for (;;) {
      const next = current.path[0];
      const holder = next ? byIdMap.get(occupancy.get(cellKey(next)) ?? '') : undefined;
      if (!holder || holder.move || resolved.has(holder.id)) break;
      const cycleStart = chain.indexOf(holder);
      if (cycleStart >= 0) {
        resolveCycle(chain.slice(cycleStart), occupancy, env, resolved);
        break;
      }
      if (holder.path.length === 0) {
        resolveStationary(chain, holder, occupancy, agents, env, resolved);
        break;
      }
      chain.push(holder);
      current = holder;
    }
  }

  return { step, agents, reservations };
}

function resolveCycle(
  cycle: Agent[],
  occupancy: Map<string, string>,
  env: MovementEnv,
  resolved: Set<string>,
): void {
  for (const member of cycle) resolved.add(member.id);
  // Ustępuje postać o najniższym pierwszeństwie, która ma dokąd zejść.
  const candidates = [...cycle].sort(byPriority).reverse();
  for (const candidate of candidates) {
    const others = cycle.filter((member) => member !== candidate);
    const path = findYieldPath(candidate, protectedCells(others), occupancy, env.grid);
    if (!path) continue;
    const index = cycle.indexOf(candidate);
    const waitingForCandidate = cycle[(index - 1 + cycle.length) % cycle.length];
    startYield(candidate, path, waitingForCandidate?.id ?? null);
    return;
  }
  for (const member of cycle) member.status = 'deadlocked';
}

function resolveStationary(
  chain: Agent[],
  holder: Agent,
  occupancy: Map<string, string>,
  agents: Agent[],
  env: MovementEnv,
  resolved: Set<string>,
): void {
  const blocked = chain[chain.length - 1];
  if (!blocked) return;
  resolved.add(holder.id);
  for (const member of chain) resolved.add(member.id);

  if (PUSHABLE.has(holder.status)) {
    const path = findYieldPath(holder, protectedCells(chain), occupancy, env.grid);
    if (path) {
      startYield(holder, path, blocked.id);
      return;
    }
  }
  // Postaci korzystającej z obiektu nie przesuwamy — szukamy drogi naokoło stojących postaci.
  if (blocked.waitedSteps < env.config.replanAfterSteps) return;
  const goal = currentGoal(blocked, env);
  if (!goal) return;
  const standing = new Set(
    agents.filter((agent) => !agent.move && agent.path.length === 0).map((a) => cellKey(a.cell)),
  );
  const detour = findPath(env.grid, blocked.cell, goal, standing);
  if (detour) {
    blocked.path = detour;
    return;
  }
  // MOVE-08: stoi ktoś, kogo nie da się przesunąć, a objazdu nie ma — jawna blokada zamiast
  // cichego czekania. Osoba korzystająca z obiektu w końcu zwolni miejsce, więc wtedy czekamy.
  if (PUSHABLE.has(holder.status)) blocked.status = 'deadlocked';
}

function startYield(agent: Agent, path: Cell[], yieldingTo: string | null): void {
  agent.path = path;
  agent.status = 'yielding';
  agent.yieldingTo = yieldingTo;
  agent.yieldHeldSteps = 0;
}

// Najbliższe wolne pole poza trasami przepuszczanych postaci, osiągalne po wolnych polach
// (T:MOVE-05 — ustąpienie na wolne pole lub cofnięcie do miejsca minięcia).
function findYieldPath(
  agent: Agent,
  protectedKeys: ReadonlySet<string>,
  occupancy: Map<string, string>,
  grid: MovementGrid,
): Cell[] | null {
  const startKey = cellKey(agent.cell);
  const cameFrom = new Map<string, Cell>();
  const queue: Cell[] = [agent.cell];
  const seen = new Set([startKey]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const key = cellKey(current);
    if (key !== startKey && !protectedKeys.has(key)) {
      const path: Cell[] = [];
      let cell: Cell | undefined = current;
      while (cell && cellKey(cell) !== startKey) {
        path.push(cell);
        cell = cameFrom.get(cellKey(cell));
      }
      return path.reverse();
    }
    for (const next of [
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y - 1 },
    ]) {
      const nextKey = cellKey(next);
      if (seen.has(nextKey) || !grid.passable(next)) continue;
      const holder = occupancy.get(nextKey);
      if (holder !== undefined && holder !== agent.id) continue;
      seen.add(nextKey);
      cameFrom.set(nextKey, current);
      queue.push(next);
    }
  }
  return null;
}

function protectedCells(agents: readonly Agent[]): Set<string> {
  const keys = new Set<string>();
  for (const agent of agents) for (const cell of footprintOf(agent)) keys.add(cellKey(cell));
  return keys;
}

function footprintOf(agent: Agent): Cell[] {
  return [agent.cell, ...(agent.move ? [agent.move.to] : []), ...agent.path];
}

function intersects(route: readonly Cell[], cells: readonly Cell[]): boolean {
  const keys = new Set(cells.map(cellKey));
  return route.some((cell) => keys.has(cellKey(cell)));
}

function byId(a: Agent, b: Agent): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Wyższe pierwszeństwo: dłuższe oczekiwanie, potem stabilne ID (T:MOVE-07).
function byPriority(a: Agent, b: Agent): number {
  return b.waitedSteps - a.waitedSteps || byId(a, b);
}

function cloneAgent(agent: ReadonlyAgent): Agent {
  return {
    ...agent,
    cell: { ...agent.cell },
    move: agent.move ? { to: { ...agent.move.to }, elapsed: agent.move.elapsed } : null,
    tasks: [...agent.tasks],
    path: agent.path.map((cell) => ({ ...cell })),
  };
}
