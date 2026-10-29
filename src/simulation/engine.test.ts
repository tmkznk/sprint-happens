import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from '../domain/config';
import { createInitialState, type Speed } from '../domain/state';
import { testEngine } from '../test/engineFixture';
import { createEngine } from './engine';
import { DAY_LENGTH_MS } from './time';

describe('createInitialState', () => {
  it('startuje misję pierwszego dnia, na pauzie, z budżetem z konfiguracji', () => {
    const config: BalanceConfig = {
      ...DEFAULT_BALANCE,
      mission: { ...DEFAULT_BALANCE.mission, startingCash: 1234 },
    };
    const state = createInitialState(config, 1);

    expect(state.mission).toEqual({
      status: 'active',
      day: 1,
      phase: 'working',
      speed: 0,
      timeInDayMs: 0,
      transitSteps: 0,
      report: null,
      reputation: 50,
    });
    expect(state.finance.cash).toBe(1234);
  });

  it('nie przechowuje konfiguracji w stanie misji', () => {
    const snapshot = JSON.stringify(createInitialState(DEFAULT_BALANCE, 1));

    expect(snapshot).not.toContain('startingCash');
    expect(snapshot).not.toContain('stepMs');
  });
});

describe('createEngine', () => {
  it.each([0, -100, 7, 99.5])('odrzuca krok %s ms, który nie dzieli dnia', (stepMs) => {
    const config: BalanceConfig = {
      ...DEFAULT_BALANCE,
      simulation: { ...DEFAULT_BALANCE.simulation, stepMs },
    };

    expect(() => createEngine({ config, initialState: createInitialState(config, 1) })).toThrow();
  });
});

describe('engine.dispatch', () => {
  it('wykonuje poprawne polecenie i zwraca nowy obiekt stanu', () => {
    const engine = testEngine();
    const before = engine.getState();

    expect(engine.dispatch({ type: 'SetSpeed', speed: 4 })).toEqual({ ok: true });
    expect(engine.getState().mission.speed).toBe(4);
    expect(engine.getState()).not.toBe(before);
    expect(before.mission.speed).toBe(0);
  });

  it('działa na pauzie, gdy faza na to pozwala', () => {
    const engine = testEngine({ speed: 0 });

    expect(engine.dispatch({ type: 'SetSpeed', speed: 1 }).ok).toBe(true);
  });

  it.each([
    ['nieobsługiwane tempo', {}, 3, 'invalidSpeed'],
    ['faza po zakończeniu pracy', { phase: 'workEnded' }, 1, 'phaseNotAllowed'],
    ['faza po rozliczeniu', { phase: 'settled' }, 1, 'phaseNotAllowed'],
    ['zakończona misja', { status: 'won' }, 1, 'missionEnded'],
  ] as const)('odrzuca polecenie: %s — bez zmiany stanu', (_, patch, speed, code) => {
    const engine = testEngine(patch);
    const before = engine.getState();

    const result = engine.dispatch({ type: 'SetSpeed', speed: speed as Speed });

    expect(result).toEqual({ ok: false, rejection: { code } });
    expect(engine.getState()).toBe(before);
  });
});

describe('engine.step', () => {
  const stepsPerDay = DAY_LENGTH_MS / DEFAULT_BALANCE.simulation.stepMs;

  it('przesuwa czas dnia o jeden krok', () => {
    const engine = testEngine({ speed: 1 });

    engine.step();

    expect(engine.getState().mission.timeInDayMs).toBe(DEFAULT_BALANCE.simulation.stepMs);
  });

  it('kończy dzień pracy dokładnie po 600 s czasu gry i pauzuje', () => {
    const engine = testEngine({ speed: 1 });

    for (let i = 0; i < stepsPerDay - 1; i++) engine.step();
    expect(engine.getState().mission.phase).toBe('working');

    // TIME-08: o 17:00 praca się kończy, zegar staje; puste biuro wychodzi w kolejnym kroku.
    engine.step();
    expect(engine.getState().mission).toMatchObject({
      phase: 'leaving',
      speed: 1,
      timeInDayMs: DAY_LENGTH_MS,
    });

    engine.step();
    expect(engine.getState().mission).toMatchObject({
      phase: 'workEnded',
      speed: 0,
      timeInDayMs: DAY_LENGTH_MS,
    });
  });

  it.each([
    ['pauza', { speed: 0 }],
    ['koniec pracy', { phase: 'workEnded', speed: 1 }],
    ['zakończona misja', { status: 'bankrupt', speed: 1 }],
  ] as const)('nie zmienia stanu: %s', (_, patch) => {
    const engine = testEngine(patch);
    const before = engine.getState();

    engine.step();

    expect(engine.getState()).toBe(before);
  });
});

describe('engine.subscribe', () => {
  it('powiadamia o zmianie stanu, a nie o odrzuceniu ani poleceniu bez skutku', () => {
    const engine = testEngine({ speed: 1 });
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.dispatch({ type: 'SetSpeed', speed: 3 as Speed });
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    expect(listener).not.toHaveBeenCalled();

    engine.dispatch({ type: 'SetSpeed', speed: 2 });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(engine.getState());
  });

  it('przestaje powiadamiać po wypisaniu', () => {
    const engine = testEngine();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);

    unsubscribe();
    engine.dispatch({ type: 'SetSpeed', speed: 2 });

    expect(listener).not.toHaveBeenCalled();
  });
});
