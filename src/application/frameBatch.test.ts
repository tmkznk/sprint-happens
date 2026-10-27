import { describe, expect, it, vi } from 'vitest';
import { frameBatched, type FrameScheduler } from './frameBatch';

function fakeScheduler() {
  const queue = new Map<number, () => void>();
  let next = 1;
  const scheduler: FrameScheduler = {
    request(callback) {
      queue.set(next, callback);
      return next++;
    },
    cancel(handle) {
      queue.delete(handle);
    },
  };
  return {
    scheduler,
    pending: () => queue.size,
    frame() {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback();
    },
  };
}

function source() {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: () => listeners.forEach((listener) => listener()),
    count: () => listeners.size,
  };
}

describe('frameBatched', () => {
  it('kilka zmian w jednej klatce daje jedno powiadomienie', () => {
    const frames = fakeScheduler();
    const store = source();
    const subscribe = frameBatched(store.subscribe, frames.scheduler);
    const listener = vi.fn();
    subscribe(listener);

    store.emit();
    store.emit();
    store.emit();
    expect(listener).not.toHaveBeenCalled();
    frames.frame();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('bez zmian nie planuje klatki', () => {
    const frames = fakeScheduler();
    const store = source();
    frameBatched(store.subscribe, frames.scheduler)(vi.fn());
    expect(frames.pending()).toBe(0);
  });

  it('subskrybuje źródło tylko przy słuchaczach i sprząta zaplanowaną klatkę', () => {
    const frames = fakeScheduler();
    const store = source();
    const subscribe = frameBatched(store.subscribe, frames.scheduler);
    expect(store.count()).toBe(0);
    const stopA = subscribe(vi.fn());
    const stopB = subscribe(vi.fn());
    expect(store.count()).toBe(1);

    store.emit();
    stopA();
    stopB();
    expect(store.count()).toBe(0);
    expect(frames.pending()).toBe(0);
  });

  it('słuchacz wypisany przed klatką nie dostaje powiadomienia', () => {
    const frames = fakeScheduler();
    const store = source();
    const subscribe = frameBatched(store.subscribe, frames.scheduler);
    const kept = vi.fn();
    const removed = vi.fn();
    subscribe(kept);
    const stop = subscribe(removed);

    store.emit();
    stop();
    frames.frame();
    expect(kept).toHaveBeenCalledTimes(1);
    expect(removed).not.toHaveBeenCalled();
  });
});
