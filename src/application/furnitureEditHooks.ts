import { createContext, useContext, useSyncExternalStore } from 'react';
import type { FurnitureEdit, FurnitureEditStore } from './furnitureEdit';

export const FurnitureEditContext = createContext<FurnitureEditStore | null>(null);

export function useFurnitureEditStore(): FurnitureEditStore {
  const store = useContext(FurnitureEditContext);
  if (!store) throw new Error('Brak FurnitureEditContext — komponent musi być wewnątrz providera');
  return store;
}

export function useFurnitureEdit(): FurnitureEdit | null {
  const store = useFurnitureEditStore();
  return useSyncExternalStore(store.subscribe, store.get);
}
