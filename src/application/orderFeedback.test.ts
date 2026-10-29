import { describe, expect, it, vi } from 'vitest';
import type { EmployeeId } from '../domain/employees';
import type { CommandResult } from '../simulation/commands/types';
import { createOrderFeedbackStore } from './orderFeedback';

const ID = 'employee-1' as EmployeeId;

describe('orderFeedback', () => {
  it('zaczyna bez komunikatu', () => {
    expect(createOrderFeedbackStore().get()).toBeNull();
  });

  it('set powiadamia słuchaczy, a seq rośnie przy każdym wyniku (także tym samym)', () => {
    const store = createOrderFeedbackStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const rejection: CommandResult = { ok: false, rejection: { code: 'noAction' } };
    store.set({ employeeId: ID, result: rejection });
    const firstSeq = store.get()?.seq ?? 0;
    store.set({ employeeId: ID, result: rejection });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get()?.seq).toBeGreaterThan(firstSeq);
    expect(store.get()?.employeeId).toBe(ID);
    unsubscribe();
    store.set({ employeeId: ID, result: { ok: true } });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get()?.result).toEqual({ ok: true });
  });

  it('clear usuwa komunikat', () => {
    const store = createOrderFeedbackStore();
    store.set({ employeeId: ID, result: { ok: true } });
    store.clear();
    expect(store.get()).toBeNull();
  });
});
