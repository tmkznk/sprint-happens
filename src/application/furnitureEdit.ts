import type { FurnitureId, Rotation } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';

// UX-04 (Z): tryb „Urządź” — podgląd ustawienia mebla przed zatwierdzeniem. To stan prezentacji
// (T:ARCH-02): do silnika trafia dopiero polecenie MoveFurniture; anulowanie niczego nie zmienia.
export type FurnitureEdit = { furnitureId: FurnitureId; origin: GridPoint; rotation: Rotation };

export type FurnitureEditStore = {
  get(): FurnitureEdit | null;
  set(edit: FurnitureEdit | null): void;
  subscribe(listener: () => void): () => void;
};

export function createFurnitureEditStore(): FurnitureEditStore {
  let edit: FurnitureEdit | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => edit,
    set(next) {
      edit = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
