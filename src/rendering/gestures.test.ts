import { describe, expect, it } from 'vitest';
import { createGestureTracker } from './gestures';

describe('createGestureTracker', () => {
  it('krótkie dotknięcie w obrębie progu to wybór w punkcie startu', () => {
    const tracker = createGestureTracker(10);

    tracker.down({ id: 1, x: 100, y: 100 });
    expect(tracker.move({ id: 1, x: 104, y: 103 })).toEqual([]);

    expect(tracker.up({ id: 1, x: 104, y: 103 })).toEqual([{ type: 'tap', x: 100, y: 100 }]);
  });

  it('przeciąganie przesuwa kamerę i nie kończy się wyborem', () => {
    const tracker = createGestureTracker(10);
    tracker.down({ id: 1, x: 100, y: 100 });

    expect(tracker.move({ id: 1, x: 120, y: 100 })).toEqual([{ type: 'pan', dx: 20, dy: 0 }]);
    expect(tracker.move({ id: 1, x: 125, y: 90 })).toEqual([{ type: 'pan', dx: 5, dy: -10 }]);
    expect(tracker.move({ id: 1, x: 101, y: 100 })).toEqual([{ type: 'pan', dx: -24, dy: 10 }]);

    expect(tracker.up({ id: 1, x: 101, y: 100 })).toEqual([]);
  });

  it('dwa palce zmieniają przybliżenie wokół środka i nie tworzą wyboru', () => {
    const tracker = createGestureTracker(10);
    tracker.down({ id: 1, x: 100, y: 100 });
    tracker.down({ id: 2, x: 200, y: 100 });

    const actions = tracker.move({ id: 2, x: 300, y: 100 });

    expect(actions).toContainEqual({ type: 'pinch', factor: 2, centerX: 200, centerY: 100 });
    expect(actions).toContainEqual({ type: 'pan', dx: 50, dy: 0 });
    expect(tracker.up({ id: 2, x: 300, y: 100 })).toEqual([]);
    expect(tracker.up({ id: 1, x: 100, y: 100 })).toEqual([]);
  });

  it('po szczypaniu pozostały palec przesuwa kamerę zamiast wybierać', () => {
    const tracker = createGestureTracker(10);
    tracker.down({ id: 1, x: 100, y: 100 });
    tracker.down({ id: 2, x: 200, y: 100 });
    tracker.up({ id: 2, x: 200, y: 100 });

    expect(tracker.move({ id: 1, x: 102, y: 100 })).toEqual([{ type: 'pan', dx: 2, dy: 0 }]);
    expect(tracker.up({ id: 1, x: 102, y: 100 })).toEqual([]);
  });

  it('ignoruje wskaźniki, które nie rozpoczęły gestu na scenie (T:VIEW-03)', () => {
    const tracker = createGestureTracker(10);

    expect(tracker.move({ id: 7, x: 50, y: 50 })).toEqual([]);
    expect(tracker.up({ id: 7, x: 50, y: 50 })).toEqual([]);
  });

  it('anulowanie przerywa gest bez wyboru', () => {
    const tracker = createGestureTracker(10);
    tracker.down({ id: 1, x: 100, y: 100 });

    tracker.cancel();

    expect(tracker.up({ id: 1, x: 100, y: 100 })).toEqual([]);
  });
});
