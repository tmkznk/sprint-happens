import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from '../domain/config';
import { createInitialState, type GameState, type Speed } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { createEngine } from './engine';

function engineWith(patch: Partial<GameState['mission']> = {}) {
  const initial = createInitialState(DEFAULT_BALANCE);
  const initialState = deepFreeze({ ...initial, mission: { ...initial.mission, ...patch } });
  return createEngine({ config: DEFAULT_BALANCE, initialState });
}

describe('createInitialState', () => {
  it('startuje misję pierwszego dnia, na pauzie, z budżetem z konfiguracji', () => {
    const config: BalanceConfig = { mission: { startingCash: 1234 } };
    const state = createInitialState(config);

    expect(state.mission).toEqual({ status: 'active', day: 1, phase: 'working', speed: 0 });
    expect(state.finance.cash).toBe(1234);
  });

  it('nie przechowuje konfiguracji w stanie misji', () => {
    expect(JSON.stringify(createInitialState(DEFAULT_BALANCE))).not.toContain('startingCash');
  });
});

describe('engine.dispatch', () => {
  it('wykonuje poprawne polecenie i zwraca nowy obiekt stanu', () => {
    const engine = engineWith();
    const before = engine.getState();

    expect(engine.dispatch({ type: 'SetSpeed', speed: 4 })).toEqual({ ok: true });
    expect(engine.getState().mission.speed).toBe(4);
    expect(engine.getState()).not.toBe(before);
    expect(before.mission.speed).toBe(0);
  });

  it('działa na pauzie, gdy faza na to pozwala', () => {
    const engine = engineWith({ speed: 0 });

    expect(engine.dispatch({ type: 'SetSpeed', speed: 1 }).ok).toBe(true);
  });

  it.each([
    ['nieobsługiwane tempo', {}, 3, 'invalidSpeed'],
    ['faza po zakończeniu pracy', { phase: 'workEnded' }, 1, 'phaseNotAllowed'],
    ['faza po rozliczeniu', { phase: 'settled' }, 1, 'phaseNotAllowed'],
    ['zakończona misja', { status: 'won' }, 1, 'missionEnded'],
  ] as const)('odrzuca polecenie: %s — bez zmiany stanu', (_, patch, speed, code) => {
    const engine = engineWith(patch);
    const before = engine.getState();

    const result = engine.dispatch({ type: 'SetSpeed', speed: speed as Speed });

    expect(result).toEqual({ ok: false, rejection: { code } });
    expect(engine.getState()).toBe(before);
  });
});

describe('engine.subscribe', () => {
  it('powiadamia o zmianie stanu, a nie o odrzuceniu ani poleceniu bez skutku', () => {
    const engine = engineWith({ speed: 1 });
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
    const engine = engineWith();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);

    unsubscribe();
    engine.dispatch({ type: 'SetSpeed', speed: 2 });

    expect(listener).not.toHaveBeenCalled();
  });
});
