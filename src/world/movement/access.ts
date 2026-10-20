import type { Furniture, FurnitureId } from '../../domain/furniture';
import type { GridPoint } from '../../domain/grid';
import { interactionCells } from '../geometry';
import type { OfficeLayout } from '../officeLayout';
import { cellKey, gridFromOffice, neighbours } from './grid';
import { reachableCells } from './pathfinding';

export type AccessViolation =
  // OFF-05 (Z): punkt korzystania z mebla musi być osiągalny od wejścia.
  | { code: 'interactionPointUnreachable'; furnitureId: FurnitureId; cell: GridPoint }
  // OFF-05 (Z): drzwi nie mogą być zastawione.
  | { code: 'doorBlocked'; cell: GridPoint }
  // Decyzja SH-003: osoba korzystająca z mebla stoi w jego punkcie i nie jest przesuwana,
  // więc punkt korzystania nie może być jedynym przejściem do innych wymaganych pól.
  | { code: 'interactionPointCutsPassage'; furnitureId: FurnitureId; cell: GridPoint };

// MOVE-06 (Z): nie można zatwierdzić wyposażenia odcinającego wymagany dostęp.
export function validateAccess(
  layout: OfficeLayout,
  furniture: readonly Furniture[],
): AccessViolation[] {
  const grid = gridFromOffice(layout, furniture);
  const entrance = layout.doors.find((door) => door.isEntrance)?.position;
  if (!entrance) throw new Error('Układ biura nie ma wejścia');

  const points = furniture.flatMap((item) =>
    interactionCells(item).map((cell) => ({ furnitureId: item.id, cell })),
  );
  const required = [...points.map((point) => point.cell), ...layout.doors.map((d) => d.position)];
  const reachable = reachableCells(grid, entrance);
  const violations: AccessViolation[] = [];

  for (const door of layout.doors) {
    const sides = neighbours(door.position).filter((cell) => grid.passable(cell));
    if (!reachable.has(cellKey(door.position)) || sides.length < (door.isEntrance ? 1 : 2)) {
      violations.push({ code: 'doorBlocked', cell: door.position });
    }
  }
  for (const point of points) {
    if (!reachable.has(cellKey(point.cell))) {
      violations.push({ code: 'interactionPointUnreachable', ...point });
    }
  }
  for (const point of points) {
    if (!reachable.has(cellKey(point.cell))) continue;
    const withoutPoint = reachableCells(grid, entrance, new Set([cellKey(point.cell)]));
    const cutsOff = required.some(
      (cell) =>
        cellKey(cell) !== cellKey(point.cell) &&
        reachable.has(cellKey(cell)) &&
        !withoutPoint.has(cellKey(cell)),
    );
    if (cutsOff) violations.push({ code: 'interactionPointCutsPassage', ...point });
  }
  return violations;
}
