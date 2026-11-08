import { describe, expect, it } from 'vitest';
import type { SaveStatus } from './saveManager';
import { createFlightGuard, watchConflict } from './sessionGuards';

describe('createFlightGuard — drugie dotknięcie w trakcie operacji', () => {
  it('nie uruchamia operacji drugi raz, dopóki pierwsza trwa; potem znowu można', async () => {
    let calls = 0;
    let release = () => {};
    const guard = createFlightGuard();
    const operation = () =>
      new Promise<void>((resolve) => {
        calls++;
        release = resolve;
      });
    const run = () => guard.run(operation);
    const first = run();
    void run();
    expect(calls).toBe(1);
    release();
    await first;
    void run();
    expect(calls).toBe(2);
  });
});

describe('watchConflict — konflikt zapisu sprzed subskrypcji', () => {
  function manager(initial: SaveStatus) {
    let status = initial;
    const listeners = new Set<() => void>();
    return {
      getStatus: () => status,
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      set(next: SaveStatus) {
        status = next;
        for (const listener of listeners) listener();
      },
    };
  }

  it('sesja już w konflikcie zgłasza go od razu', () => {
    let conflicts = 0;
    watchConflict(manager({ kind: 'conflict', message: 'x' }), () => conflicts++);
    expect(conflicts).toBe(1);
  });

  it('późniejszy konflikt też jest zgłaszany', () => {
    let conflicts = 0;
    const m = manager({ kind: 'idle' });
    watchConflict(m, () => conflicts++);
    expect(conflicts).toBe(0);
    m.set({ kind: 'conflict', message: 'x' });
    expect(conflicts).toBe(1);
  });
});
