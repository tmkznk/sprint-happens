export type PointerSample = { id: number; x: number; y: number };

export type GestureAction =
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'pinch'; factor: number; centerX: number; centerY: number }
  | { type: 'tap'; x: number; y: number };

// Ruch palca poniżej progu nadal jest dotknięciem; powyżej — przeciąganiem kamery,
// które nie może zakończyć się przypadkowym wyborem obiektu (SH-010).
export const TAP_SLOP_PX = 10;

export type GestureTracker = {
  down(sample: PointerSample): GestureAction[];
  move(sample: PointerSample): GestureAction[];
  up(sample: PointerSample): GestureAction[];
  cancel(): void;
};

type Tracked = { start: PointerSample; current: PointerSample };

// UX-01, UX-02 (Z): dotknięcie wybiera, przeciągnięcie przesuwa kamerę, dwa palce zmieniają
// przybliżenie. Śledzi wyłącznie wskaźniki, które zaczęły gest na scenie (T:VIEW-03).
export function createGestureTracker(tapSlopPx = TAP_SLOP_PX): GestureTracker {
  const pointers = new Map<number, Tracked>();
  // pending: jeden palec w obrębie progu; pan: przeciąganie; pinch: dwa palce.
  let mode: 'idle' | 'pending' | 'pan' | 'pinch' = 'idle';

  function pinchPair(): [PointerSample, PointerSample] | null {
    const [a, b] = [...pointers.values()];
    return a && b ? [a.current, b.current] : null;
  }

  return {
    down(sample) {
      pointers.set(sample.id, { start: sample, current: sample });
      mode = pointers.size === 1 ? 'pending' : 'pinch';
      return [];
    },

    move(sample) {
      const tracked = pointers.get(sample.id);
      if (!tracked) return [];

      if (mode === 'pinch') {
        const before = pinchPair();
        tracked.current = sample;
        const after = pinchPair();
        if (!before || !after) return [];
        const previousDistance = distance(...before);
        const previousCenter = midpoint(...before);
        const center = midpoint(...after);
        const actions: GestureAction[] = [
          { type: 'pan', dx: center.x - previousCenter.x, dy: center.y - previousCenter.y },
        ];
        if (previousDistance > 0) {
          actions.push({
            type: 'pinch',
            factor: distance(...after) / previousDistance,
            centerX: center.x,
            centerY: center.y,
          });
        }
        return actions;
      }

      const previous = tracked.current;
      tracked.current = sample;
      if (mode === 'pending') {
        if (distance(tracked.start, sample) <= tapSlopPx) return [];
        mode = 'pan';
        // Przy przekroczeniu progu kamera dogania palec od punktu startu.
        return [{ type: 'pan', dx: sample.x - tracked.start.x, dy: sample.y - tracked.start.y }];
      }
      if (mode === 'pan') {
        return [{ type: 'pan', dx: sample.x - previous.x, dy: sample.y - previous.y }];
      }
      return [];
    },

    up(sample) {
      const tracked = pointers.get(sample.id);
      if (!tracked) return [];
      pointers.delete(sample.id);

      const isTap =
        mode === 'pending' && pointers.size === 0 && distance(tracked.start, sample) <= tapSlopPx;
      // Po szczypaniu pozostały palec kontynuuje przesuwanie, nigdy nie tworzy dotknięcia.
      mode = pointers.size === 0 ? 'idle' : 'pan';
      return isTap ? [{ type: 'tap', x: tracked.start.x, y: tracked.start.y }] : [];
    },

    cancel() {
      pointers.clear();
      mode = 'idle';
    },
  };
}

function distance(a: PointerSample, b: PointerSample): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: PointerSample, b: PointerSample): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
