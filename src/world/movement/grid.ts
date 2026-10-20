import type { Furniture } from '../../domain/furniture';
import type { GridPoint, Size } from '../../domain/grid';
import { occupiedCells } from '../geometry';
import { cellKindAt, type OfficeLayout } from '../officeLayout';

export type Cell = GridPoint;

// Statyczna mapa przejść: ściany i footprinty mebli są przeszkodami (MOVE-01).
// Inne postacie nie są tu przeszkodami — konflikty między nimi rozstrzyga movement.ts.
export type MovementGrid = {
  size: Size;
  passable(cell: Cell): boolean;
};

export const cellKey = (cell: Cell): string => `${cell.x},${cell.y}`;

export const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

// Kolejność sąsiadów jest stała, aby wyniki były deterministyczne.
export function neighbours(cell: Cell): Cell[] {
  return [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y - 1 },
  ];
}

export function gridFromOffice(
  layout: OfficeLayout,
  furniture: readonly Furniture[],
): MovementGrid {
  const blocked = new Set(furniture.flatMap(occupiedCells).map(cellKey));
  return {
    size: layout.size,
    passable: (cell) => {
      const kind = cellKindAt(layout, cell);
      return (kind === 'floor' || kind === 'door') && !blocked.has(cellKey(cell));
    },
  };
}

// Mapa z rysunku ASCII: '#' to ściana, każdy inny znak to podłoga. Litery i cyfry
// oznaczają nazwane punkty (starty postaci, cele, miejsca korzystania).
export function gridFromAscii(rows: readonly string[]): {
  grid: MovementGrid;
  points: Record<string, Cell>;
} {
  const points: Record<string, Cell> = {};
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (/[A-Za-z0-9]/.test(char)) points[char] = { x, y };
    });
  });
  const width = Math.max(...rows.map((row) => row.length));
  return {
    grid: {
      size: { width, height: rows.length },
      passable: ({ x, y }) => {
        const char = rows[y]?.[x];
        return char !== undefined && char !== '#';
      },
    },
    points,
  };
}
