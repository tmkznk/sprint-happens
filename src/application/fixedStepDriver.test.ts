import { describe, expect, it } from 'vitest';
import type { Speed } from '../domain/state';
import { testEngine } from '../test/engineFixture';
import { createFixedStepDriver } from './fixedStepDriver';

const FRAME_MS = 1000 / 60;

function runFrames(speed: Speed, realMs: number) {
  const engine = testEngine({ speed });
  const driver = createFixedStepDriver(engine);
  let steps = 0;
  for (let elapsed = 0; elapsed < realMs - 1e-6; elapsed += FRAME_MS) {
    steps += driver.advance(Math.min(FRAME_MS, realMs - elapsed));
  }
  return { engine, steps };
}

describe('createFixedStepDriver', () => {
  // F:16 przypadek 1 — 600 s przy 1×, 300 s przy 2× i 150 s przy 4× dają ten sam upływ dnia.
  it.each([
    [1, 600_000],
    [2, 300_000],
    [4, 150_000],
  ] as const)('przy %s× kończy dzień po %s ms czasu rzeczywistego', (speed, realMs) => {
    const { engine, steps } = runFrames(speed, realMs);

    // Dzień pracy kończy się dokładnie po 6000 krokach; puste biuro wychodzi w kolejnym kroku.
    expect(steps).toBe(6000);
    expect(engine.getState().mission).toMatchObject({ phase: 'leaving', timeInDayMs: 600_000 });
    expect(createFixedStepDriver(engine).advance(100)).toBe(1);
    expect(engine.getState().mission).toMatchObject({ phase: 'workEnded', speed: 0 });
  });

  it('wykonuje identyczne kroki niezależnie od tempa — ten sam stan przy tym samym czasie gry', () => {
    const states = ([1, 2, 4] as const).map((speed) => {
      const { engine, steps } = runFrames(speed, 60_000 / speed);
      return {
        steps,
        state: { ...engine.getState(), mission: { ...engine.getState().mission, speed: 0 } },
      };
    });

    expect(states[0]?.steps).toBe(600);
    expect(states[1]).toEqual(states[0]);
    expect(states[2]).toEqual(states[0]);
  });

  it('na pauzie nie wykonuje kroków ani nie gromadzi czasu', () => {
    const engine = testEngine({ speed: 0 });
    const driver = createFixedStepDriver(engine);

    expect(driver.advance(10_000)).toBe(0);
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    expect(driver.advance(50)).toBe(0);
    expect(engine.getState().mission.timeInDayMs).toBe(0);
  });

  it('ogranicza długą klatkę zamiast nadrabiać — gra zwalnia, nie pomija kroków', () => {
    const engine = testEngine({ speed: 1 });
    const driver = createFixedStepDriver(engine, 250);

    expect(driver.advance(10_000)).toBe(2);
    expect(engine.getState().mission.timeInDayMs).toBe(200);
  });

  it('zatrzymuje kroki w klatce, w której kończy się dzień', () => {
    const engine = testEngine({ speed: 4, timeInDayMs: 599_900 });
    const driver = createFixedStepDriver(engine);

    // Ostatni krok dnia pracy i krok wyjścia pustego biura; koniec pracy pauzuje w tej klatce.
    expect(driver.advance(250)).toBe(2);
    expect(engine.getState().mission.phase).toBe('workEnded');
    expect(driver.advance(250)).toBe(0);
  });

  it('udostępnia ułamek bieżącego kroku do interpolacji (T:TIME-T02)', () => {
    const engine = testEngine({ speed: 1 });
    const driver = createFixedStepDriver(engine);

    driver.advance(150);
    expect(driver.alpha()).toBeCloseTo(0.5);
    driver.reset();
    expect(driver.alpha()).toBe(0);
  });
});
