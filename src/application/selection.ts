import type { EmployeeId } from '../domain/employees';
import type { FurnitureId } from '../domain/furniture';

// T:ARCH-02 — zaznaczenie należy do stanu prezentacji, nie do stanu gry; nie trafia do zapisu.
export type Selection =
  { kind: 'furniture'; id: FurnitureId } | { kind: 'employee'; id: EmployeeId } | null;

export type SelectionStore = {
  get(): Selection;
  set(selection: Selection): void;
  subscribe(listener: () => void): () => void;
};

export function createSelectionStore(): SelectionStore {
  let selection: Selection = null;
  const listeners = new Set<() => void>();
  return {
    get: () => selection,
    set(next) {
      if (next === selection || (next && selection && next.id === selection.id)) return;
      selection = next;
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
