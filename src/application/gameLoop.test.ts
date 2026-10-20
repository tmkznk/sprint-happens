import { describe, expect, it } from 'vitest';
import { testEngine } from '../test/engineFixture';
import { startGameLoop, type LoopEnvironment } from './gameLoop';

function fakeEnvironment() {
  let pending: ((nowMs: number) => void) | null = null;
  let backgroundListener: (() => void) | null = null;
  const environment: LoopEnvironment = {
    requestFrame(callback) {
      pending = callback;
      return 1;
    },
    cancelFrame() {
      pending = null;
    },
    onBackground(listener) {
      backgroundListener = listener;
      return () => {
        backgroundListener = null;
      };
    },
  };
  return {
    environment,
    frame(nowMs: number) {
      const callback = pending;
      pending = null;
      callback?.(nowMs);
    },
    goToBackground: () => backgroundListener?.(),
    isRunning: () => pending !== null,
    isListening: () => backgroundListener !== null,
  };
}

describe('startGameLoop', () => {
  it('przelicza czas między klatkami na kroki silnika', () => {
    const engine = testEngine({ speed: 1 });
    const fake = fakeEnvironment();
    startGameLoop(engine, fake.environment);

    fake.frame(0);
    fake.frame(100);
    fake.frame(200);

    expect(engine.getState().mission.timeInDayMs).toBe(200);
  });

  it('przejście do tła pauzuje grę; po powrocie brak nadrabiania i dalej pauza', () => {
    const engine = testEngine({ speed: 4 });
    const fake = fakeEnvironment();
    startGameLoop(engine, fake.environment);
    fake.frame(0);
    fake.frame(100);
    const timeBeforeBackground = engine.getState().mission.timeInDayMs;

    fake.goToBackground();
    fake.frame(3_600_000);
    fake.frame(3_600_100);

    expect(engine.getState().mission.speed).toBe(0);
    expect(engine.getState().mission.timeInDayMs).toBe(timeBeforeBackground);
  });

  it('po wznowieniu nie nalicza czasu spędzonego w tle', () => {
    const engine = testEngine({ speed: 1 });
    const fake = fakeEnvironment();
    startGameLoop(engine, fake.environment);
    fake.frame(0);

    fake.goToBackground();
    fake.frame(3_600_000);
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    fake.frame(3_600_100);

    expect(engine.getState().mission.timeInDayMs).toBe(100);
  });

  it('zatrzymanie usuwa pętlę i listenery', () => {
    const fake = fakeEnvironment();
    const stop = startGameLoop(testEngine(), fake.environment);

    stop();

    expect(fake.isRunning()).toBe(false);
    expect(fake.isListening()).toBe(false);
  });
});
