import type { BalanceConfig } from '../../domain/config';
import type { Furniture } from '../../domain/furniture';
import type { GameState } from '../../domain/state';
import { interactionCells } from '../geometry';
import { officeLayoutOf, type OfficeLayout } from '../officeLayout';
import { gridFromOffice } from './grid';
import type { Destination, MovementEnv } from './movement';

type WorldShape = Pick<MovementEnv, 'grid' | 'destinations'>;

// Mapa przejść i miejsca korzystania wyliczane z układu biura i bieżących mebli. Stan jest
// niemutowalny, więc obiekt mebli zmienia referencję tylko przy faktycznej zmianie wyposażenia.
const cache = new WeakMap<object, WorldShape>();

export function movementEnvFor(
  state: GameState,
  config: BalanceConfig,
  layout: OfficeLayout = officeLayoutOf(state),
): MovementEnv {
  const { furniture } = state.world;
  // Pamięć podręczna tylko dla układu tego stanu (meble nie zmieniają biura misji).
  const own = layout === officeLayoutOf(state);
  let shape = own ? cache.get(furniture) : undefined;
  if (!shape) {
    const items = Object.values(furniture);
    shape = { grid: gridFromOffice(layout, items), destinations: destinationsOf(items) };
    if (own) cache.set(furniture, shape);
  }
  return { ...shape, config: config.movement };
}

// MOVE-02 (Z): każdy punkt korzystania z mebla to osobne miejsce (np. dwa siedziska kanapy).
export function destinationsOf(furniture: readonly Furniture[]): Destination[] {
  return furniture.flatMap((item) =>
    interactionCells(item).map((cell, index) => ({ id: destinationId(item.id, index), cell })),
  );
}

export function destinationId(furnitureId: string, index: number): string {
  return `${furnitureId}#${index}`;
}
