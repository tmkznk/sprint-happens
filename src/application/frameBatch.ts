export type Subscribe = (listener: () => void) => () => void;

export type FrameScheduler = {
  request(callback: () => void): number;
  cancel(handle: number): void;
};

const animationFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

// T:VIEW-02 — panele React nie odświeżają się częściej niż ekran. Przy tempie 2×/4× (albo po
// przyciętej, długiej klatce) silnik wykonuje kilka kroków naraz i po każdym powiadamia
// subskrybentów; dla UI łączymy to w jedno powiadomienie na klatkę. Źródło jest subskrybowane
// tylko wtedy, gdy ktoś słucha.
export function frameBatched(
  subscribe: Subscribe,
  scheduler: FrameScheduler = animationFrames,
): Subscribe {
  const listeners = new Set<() => void>();
  let unsubscribe: (() => void) | null = null;
  let frame: number | null = null;

  const flush = () => {
    frame = null;
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) listener();
    }
  };

  return (listener) => {
    listeners.add(listener);
    unsubscribe ??= subscribe(() => {
      frame ??= scheduler.request(flush);
    });
    return () => {
      listeners.delete(listener);
      if (listeners.size > 0) return;
      unsubscribe?.();
      unsubscribe = null;
      if (frame !== null) scheduler.cancel(frame);
      frame = null;
    };
  };
}
