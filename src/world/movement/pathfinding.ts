import { cellKey, neighbours, sameCell, type Cell, type MovementGrid } from './grid';

// T:MOVE-07 (R): A* na siatce z czterema sąsiadami. Zwraca kolejne pola bez pola startowego
// (pusta tablica, gdy start jest celem) albo null, gdy cel jest nieosiągalny.
// `blocked` pozwala tymczasowo traktować wybrane pola (np. stojące postacie) jako przeszkody.
export function findPath(
  grid: MovementGrid,
  from: Cell,
  to: Cell,
  blocked: ReadonlySet<string> = new Set(),
): Cell[] | null {
  if (sameCell(from, to)) return [];
  if (!grid.passable(to) || blocked.has(cellKey(to))) return null;

  const heuristic = (cell: Cell) => Math.abs(cell.x - to.x) + Math.abs(cell.y - to.y);
  type Node = { cell: Cell; g: number; f: number; order: number };
  const open: Node[] = [{ cell: from, g: 0, f: heuristic(from), order: 0 }];
  const cameFrom = new Map<string, Cell>();
  const bestG = new Map<string, number>([[cellKey(from), 0]]);
  let order = 1;

  while (open.length > 0) {
    // Wybór deterministyczny: najmniejsze f, potem h, potem kolejność dodania.
    let bestIndex = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i];
      const b = open[bestIndex];
      if (!a || !b) continue;
      const better =
        a.f < b.f ||
        (a.f === b.f && (a.f - a.g < b.f - b.g || (a.f - a.g === b.f - b.g && a.order < b.order)));
      if (better) bestIndex = i;
    }
    const [current] = open.splice(bestIndex, 1);
    if (!current) break;
    if (sameCell(current.cell, to)) return reconstruct(cameFrom, from, to);

    for (const next of neighbours(current.cell)) {
      const key = cellKey(next);
      if (!grid.passable(next) || blocked.has(key)) continue;
      const g = current.g + 1;
      if (g >= (bestG.get(key) ?? Infinity)) continue;
      bestG.set(key, g);
      cameFrom.set(key, current.cell);
      open.push({ cell: next, g, f: g + heuristic(next), order: order++ });
    }
  }
  return null;
}

function reconstruct(cameFrom: Map<string, Cell>, from: Cell, to: Cell): Cell[] {
  const path: Cell[] = [];
  let current: Cell | undefined = to;
  while (current && !sameCell(current, from)) {
    path.push(current);
    current = cameFrom.get(cellKey(current));
  }
  return path.reverse();
}

// Wszystkie pola osiągalne ze startu (bez `blocked`) — podstawa walidacji dostępu.
export function reachableCells(
  grid: MovementGrid,
  from: Cell,
  blocked: ReadonlySet<string> = new Set(),
): Set<string> {
  const seen = new Set<string>();
  if (!grid.passable(from) || blocked.has(cellKey(from))) return seen;
  const queue: Cell[] = [from];
  seen.add(cellKey(from));
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const next of neighbours(current)) {
      const key = cellKey(next);
      if (seen.has(key) || !grid.passable(next) || blocked.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen;
}
