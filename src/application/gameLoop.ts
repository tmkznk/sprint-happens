import type { Engine } from '../simulation/engine';
import { createFixedStepDriver } from './fixedStepDriver';

export type LoopEnvironment = {
  requestFrame(callback: (nowMs: number) => void): number;
  cancelFrame(handle: number): void;
  // Wywołuje listener, gdy aplikacja przechodzi do tła lub jest zamykana; zwraca funkcję wypisania.
  onBackground(listener: () => void): () => void;
};

export const browserEnvironment: LoopEnvironment = {
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
  onBackground(listener) {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') listener();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', listener);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', listener);
    };
  },
};

// Pętla aplikacji (T:TIME-T05): jedno źródło czasu dla silnika. Zwraca funkcję zatrzymania,
// która usuwa pętlę i listenery (T:VIEW-05).
export function startGameLoop(engine: Engine, environment = browserEnvironment): () => void {
  const driver = createFixedStepDriver(engine);
  let lastFrameMs: number | null = null;
  let handle = 0;

  const onFrame = (nowMs: number) => {
    if (lastFrameMs !== null) driver.advance(nowMs - lastFrameMs);
    lastFrameMs = nowMs;
    handle = environment.requestFrame(onFrame);
  };

  // T:TIME-T03 — tło zatrzymuje zegar; po powrocie gra stoi na pauzie i nie nadrabia nieobecności.
  const stopListening = environment.onBackground(() => {
    if (engine.getState().mission.speed !== 0) engine.dispatch({ type: 'SetSpeed', speed: 0 });
    driver.reset();
    lastFrameMs = null;
  });

  handle = environment.requestFrame(onFrame);

  return () => {
    environment.cancelFrame(handle);
    stopListening();
  };
}
