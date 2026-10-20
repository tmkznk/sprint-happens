import { describe, expect, it, vi } from 'vitest';
import type { FurnitureId } from '../domain/furniture';
import { testEngine } from '../test/engineFixture';
import { createSelectionStore } from './selection';

const id = 'furniture-1' as FurnitureId;

describe('createSelectionStore', () => {
  it('przechowuje zaznaczenie i powiadamia tylko o zmianie', () => {
    const store = createSelectionStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ kind: 'furniture', id });
    store.set({ kind: 'furniture', id });
    expect(listener).toHaveBeenCalledOnce();
    expect(store.get()).toEqual({ kind: 'furniture', id });

    store.set(null);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get()).toBeNull();
  });

  it('działa na pauzie i nie zmienia stanu gry (T:ARCH-02)', () => {
    const engine = testEngine({ speed: 0 });
    const before = engine.getState();
    const store = createSelectionStore();

    store.set({ kind: 'furniture', id });

    expect(engine.getState()).toBe(before);
  });
});
