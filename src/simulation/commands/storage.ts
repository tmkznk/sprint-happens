import type { FurnitureType } from '../../domain/furniture';
import type { GameState } from '../../domain/state';

// Magazyn mebli: liczba sztuk danego typu i stan po zabraniu jednej (klucz znika przy zerze).
export function storedCount(state: GameState, type: FurnitureType): number {
  return state.world.storage[type] ?? 0;
}

export function takeFromStorage(state: GameState, type: FurnitureType): GameState {
  const { [type]: count = 0, ...rest } = state.world.storage;
  const storage = count > 1 ? { ...rest, [type]: count - 1 } : rest;
  return { ...state, world: { ...state.world, storage } };
}
