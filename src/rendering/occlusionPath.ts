import type { GridPoint } from '../domain/grid';

// Trasa postaci w scenie testowej okluzji (SH-009 → SH-002): wzdłuż ścianki działowej, przez
// przejścia do gabinetu (przed biurko szefa) i do pokoju relaksu, potem przed biurkiem w open
// space. To wyłącznie oprawa testowa — nie jest stanem gry ani systemem ruchu (SH-011/SH-012).
export const OCCLUSION_WAYPOINTS: readonly GridPoint[] = [
  { x: 3, y: 6 },
  { x: 3, y: 3 },
  { x: 3, y: 6 },
  { x: 10, y: 6 },
  { x: 10, y: 4 },
  { x: 10, y: 6 },
  { x: 8, y: 6 },
  { x: 8, y: 9 },
  { x: 3, y: 9 },
  { x: 3, y: 6 },
];

// Rozwija punkty pośrednie w kolejne pola, krok po jednym polu w 4 kierunkach (MOVE-01).
export function expandWaypoints(waypoints: readonly GridPoint[]): GridPoint[] {
  const [first, ...rest] = waypoints;
  if (!first) return [];
  const cells: GridPoint[] = [first];
  let current = first;
  for (const target of rest) {
    if (current.x !== target.x && current.y !== target.y) {
      throw new Error('Punkty pośrednie muszą leżeć w jednej linii lub kolumnie');
    }
    while (current.x !== target.x || current.y !== target.y) {
      current = {
        x: current.x + Math.sign(target.x - current.x),
        y: current.y + Math.sign(target.y - current.y),
      };
      cells.push(current);
    }
  }
  return cells;
}
