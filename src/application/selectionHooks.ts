import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Selection, SelectionStore } from './selection';

export const SelectionContext = createContext<SelectionStore | null>(null);

function useSelectionStore(): SelectionStore {
  const store = useContext(SelectionContext);
  if (!store) throw new Error('Brak SelectionContext — komponent musi być wewnątrz providera');
  return store;
}

export function useSelection(): Selection {
  const store = useSelectionStore();
  return useSyncExternalStore(store.subscribe, store.get);
}

// Zaznaczenie z paneli (np. „Pokaż w biurze” w zakładce Zespół).
export function useSelect(): (selection: Selection) => void {
  const store = useSelectionStore();
  return (selection) => store.set(selection);
}

export function useClearSelection(): () => void {
  const store = useSelectionStore();
  return () => store.set(null);
}
