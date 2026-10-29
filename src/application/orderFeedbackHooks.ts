import { createContext, useContext, useSyncExternalStore } from 'react';
import type { OrderFeedback, OrderFeedbackStore } from './orderFeedback';

export const OrderFeedbackContext = createContext<OrderFeedbackStore | null>(null);

function useOrderFeedbackStore(): OrderFeedbackStore {
  const store = useContext(OrderFeedbackContext);
  if (!store) throw new Error('Brak OrderFeedbackContext — komponent musi być wewnątrz providera');
  return store;
}

// Wynik ostatniego rozkazu z dotknięcia sceny (pasek postaci pokazuje odmowę).
export function useOrderFeedback(): OrderFeedback | null {
  const store = useOrderFeedbackStore();
  return useSyncExternalStore(store.subscribe, store.get);
}

export function useClearOrderFeedback(): () => void {
  const store = useOrderFeedbackStore();
  return () => store.clear();
}
