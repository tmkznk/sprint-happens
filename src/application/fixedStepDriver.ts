import type { Engine } from '../simulation/engine';

// T:TIME-T05 (R, decyzja O w SH-004): górny limit czasu rzeczywistego pojedynczej klatki.
// Przy dużym opóźnieniu gra zwalnia zamiast pomijać kroki lub liczyć je inaczej.
export const DEFAULT_MAX_FRAME_MS = 250;

// Czas klatek jest ułamkowy (np. 16,67 ms); tolerancja chroni przed utratą kroku przez
// błąd zaokrągleń przy sumowaniu. Dotyczy wyłącznie przeliczania czasu rzeczywistego.
const FLOAT_TOLERANCE_MS = 1e-6;

export type FixedStepDriver = {
  // Przyjmuje upływ czasu rzeczywistego i wykonuje tyle pełnych kroków, ile wynika z tempa.
  advance(realDeltaMs: number): number;
  // Ułamek bieżącego kroku w [0, 1) — do interpolacji pozycji na scenie (T:TIME-T02).
  alpha(): number;
  reset(): void;
};

// T:TIME-T05 — jedyny akumulator czasu: zamienia czas rzeczywisty na kroki silnika.
export function createFixedStepDriver(
  engine: Engine,
  maxFrameMs = DEFAULT_MAX_FRAME_MS,
): FixedStepDriver {
  let accumulatorMs = 0;

  return {
    advance(realDeltaMs) {
      const { speed } = engine.getState().mission;
      if (speed === 0) {
        accumulatorMs = 0;
        return 0;
      }

      accumulatorMs += Math.min(Math.max(realDeltaMs, 0), maxFrameMs) * speed;
      const { stepMs } = engine.config.simulation;
      let steps = 0;
      while (accumulatorMs >= stepMs - FLOAT_TOLERANCE_MS) {
        engine.step();
        accumulatorMs -= stepMs;
        steps++;
        // Koniec dnia pauzuje grę w trakcie klatki; reszta czasu przepada.
        if (engine.getState().mission.speed === 0) {
          accumulatorMs = 0;
          break;
        }
      }
      return steps;
    },
    alpha() {
      return Math.min(Math.max(accumulatorMs / engine.config.simulation.stepMs, 0), 0.999);
    },
    reset() {
      accumulatorMs = 0;
    },
  };
}
