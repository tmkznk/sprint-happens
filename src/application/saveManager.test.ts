import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { createMemorySaveStore } from '../persistence/saveStore';
import type { ValidationContext } from '../persistence/schema';
import { parseSnapshot } from '../persistence/snapshot';
import { testEngine } from '../test/engineFixture';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import {
  attachAutosave,
  createSaveManager,
  isAutosaveTrigger,
  loadGame,
  type AutosaveTimers,
} from './saveManager';

const context: ValidationContext = { config: DEFAULT_BALANCE, layout: OFFICE_LAYOUT };

function setup(missionPatch = {}) {
  const engine = testEngine(missionPatch);
  const memory = createMemorySaveStore();
  const manager = createSaveManager({
    engine,
    store: memory.store,
    context,
    buildVersion: '1.2.3',
    storedRevision: null,
    savedState: null,
    now: () => '2026-10-20T10:00:00.000Z',
  });
  return { engine, memory, manager };
}

describe('createSaveManager', () => {
  it('zapisuje bieżący stan z rosnącą rewizją i metadanymi', async () => {
    const { engine, memory, manager } = setup();

    await manager.save();
    engine.dispatch({ type: 'SetSpeed', speed: 2 });
    await manager.save();

    const parsed = parseSnapshot(memory.saves.current ?? '', context);
    expect(parsed).toMatchObject({
      ok: true,
      envelope: { revision: 2, gameBuildVersion: '1.2.3', savedAt: '2026-10-20T10:00:00.000Z' },
    });
    expect(parsed.ok && parsed.envelope.state).toEqual(engine.getState());
    expect(manager.getStatus()).toEqual({ kind: 'saved', revision: 2 });
  });

  it('pomija zapis, gdy stan się nie zmienił', async () => {
    const { memory, manager } = setup();
    const write = vi.spyOn(memory.store, 'write');

    await manager.save();
    await manager.save();

    expect(write).toHaveBeenCalledOnce();
  });

  it('błąd zapisu jest widoczny i nie udaje sukcesu; kolejna próba może się udać', async () => {
    const { memory, manager } = setup();
    memory.failNextWrite('QuotaExceededError');

    await manager.save();
    expect(manager.getStatus()).toEqual({ kind: 'error', message: 'QuotaExceededError' });
    expect(memory.saves.current).toBeNull();

    await manager.save();
    expect(manager.getStatus()).toEqual({ kind: 'saved', revision: 1 });
  });

  it('po konflikcie rewizji (inna karta) przestaje zapisywać', async () => {
    const { memory, manager, engine } = setup();
    await manager.save();
    memory.saves.current = JSON.stringify({ revision: 9 });
    engine.dispatch({ type: 'SetSpeed', speed: 1 });

    await manager.save();
    expect(manager.getStatus().kind).toBe('conflict');

    engine.dispatch({ type: 'SetSpeed', speed: 2 });
    await manager.save();
    expect(memory.saves.current).toBe(JSON.stringify({ revision: 9 }));
  });

  it('równoległe żądania zapisu nie tworzą konfliktu — ostatni stan zostaje zapisany', async () => {
    const { engine, memory, manager } = setup();

    const first = manager.save();
    engine.dispatch({ type: 'SetSpeed', speed: 4 });
    const second = manager.save();
    await Promise.all([first, second]);

    const parsed = parseSnapshot(memory.saves.current ?? '', context);
    expect(parsed.ok && parsed.envelope.state.mission.speed).toBe(4);
    expect(manager.getStatus().kind).toBe('saved');
  });
});

describe('attachAutosave', () => {
  function fakeTimers() {
    let tick: (() => void) | null = null;
    const timers: AutosaveTimers = {
      setInterval: (callback) => {
        tick = callback;
        return 1;
      },
      clearInterval: () => {
        tick = null;
      },
    };
    return { timers, tick: () => tick?.(), active: () => tick !== null };
  }

  it('zapisuje po ważnym poleceniu, a nie po zmianie tempa', async () => {
    const { engine, manager } = setup({ phase: 'workEnded' });
    const save = vi.spyOn(manager, 'save');
    attachAutosave(manager, engine, { timers: fakeTimers().timers });

    engine.dispatch({ type: 'SettleDay' });
    expect(save).toHaveBeenCalledOnce();
    expect(isAutosaveTrigger({ type: 'SetSpeed', speed: 1 })).toBe(false);
  });

  it('zapisuje okresowo i przy przejściu do tła; odłączenie zatrzymuje wszystko', () => {
    const { engine, manager } = setup();
    const save = vi.spyOn(manager, 'save');
    const timers = fakeTimers();
    let background: (() => void) | null = null;
    const detach = attachAutosave(manager, engine, {
      timers: timers.timers,
      onBackground: (listener) => {
        background = listener;
        return () => {
          background = null;
        };
      },
    });

    timers.tick();
    (background as (() => void) | null)?.();
    expect(save).toHaveBeenCalledTimes(2);

    detach();
    expect(timers.active()).toBe(false);
    expect(background).toBeNull();
  });
});

describe('loadGame', () => {
  it('pusty magazyn → nowa gra', async () => {
    expect(await loadGame(createMemorySaveStore().store, context)).toEqual({ kind: 'empty' });
  });

  it('wczytuje zapis i wznawia na pauzie, bez zmiany czasu dnia (SAVE-03)', async () => {
    const { engine, memory, manager } = setup({ speed: 4, timeInDayMs: 123_400 });
    await manager.save();

    const result = await loadGame(memory.store, context);

    expect(result.kind).toBe('loaded');
    if (result.kind !== 'loaded') return;
    expect(result.state.mission.speed).toBe(0);
    expect(result.state.mission.timeInDayMs).toBe(123_400);
    expect(result.savedState).toEqual(engine.getState());
    expect(result.revision).toBe(1);
  });

  it('zwraca błąd dla uszkodzonego zapisu, nie nadpisując go', async () => {
    const memory = createMemorySaveStore({ current: '{zepsute', previous: null });

    const result = await loadGame(memory.store, context);

    expect(result).toMatchObject({ kind: 'error', error: { code: 'invalidJson' } });
    expect(memory.saves.current).toBe('{zepsute');
  });
});
