import type { EmployeeId } from '../domain/employees';
import type { CommandResult } from '../simulation/commands/types';

// Wynik ostatniego rozkazu z dotknięcia sceny — stan prezentacji dla paska postaci (T:ARCH-02).
// `seq` rośnie przy każdym rozkazie, żeby ta sama odmowa pokazała się ponownie.
export type OrderFeedback = { seq: number; employeeId: EmployeeId; result: CommandResult };

export type OrderFeedbackStore = {
  get(): OrderFeedback | null;
  set(feedback: { employeeId: EmployeeId; result: CommandResult }): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
};

export function createOrderFeedbackStore(): OrderFeedbackStore {
  let feedback: OrderFeedback | null = null;
  let seq = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: () => feedback,
    set({ employeeId, result }) {
      seq += 1;
      feedback = { seq, employeeId, result };
      notify();
    },
    clear() {
      if (!feedback) return;
      feedback = null;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
