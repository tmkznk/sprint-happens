import type { FurnitureId } from '../domain/furniture';

// T:ARCH-02 — zaznaczenie należy do stanu prezentacji, nie do stanu gry; nie trafia do zapisu.
// Pracownicy dołączą jako kolejny rodzaj zaznaczenia (SH-015).
export type Selection = { kind: 'furniture'; id: FurnitureId } | null;

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
