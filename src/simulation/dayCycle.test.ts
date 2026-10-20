import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { DayPhase, GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testEngine } from '../test/engineFixture';
import { commandHandlers, type CommandType } from './commands';
import { PHASES_BY_CATEGORY, type CommandCategory } from './commands/phases';
import { createEngine } from './engine';
import { DAY_LENGTH_MS } from './time';

function runToEndOfDay(engine: ReturnType<typeof testEngine>) {
  engine.dispatch({ type: 'SetSpeed', speed: 1 });
  const steps = DAY_LENGTH_MS / DEFAULT_BALANCE.simulation.stepMs;
  for (let i = 0; i < steps; i++) engine.step();
}

describe('cykl dnia (TIME-08)', () => {
  it('koniec pracy → rozliczenie → raport → następny dzień na pauzie', () => {
    const engine = testEngine();
    runToEndOfDay(engine);
    expect(engine.getState().mission).toMatchObject({ phase: 'workEnded', speed: 0 });

    expect(engine.dispatch({ type: 'SettleDay' })).toEqual({ ok: true });
    expect(engine.getState().mission).toMatchObject({
      phase: 'settled',
      report: { day: 1, cashAfterSettlement: DEFAULT_BALANCE.mission.startingCash },
    });

    expect(engine.dispatch({ type: 'StartNextDay' })).toEqual({ ok: true });
    expect(engine.getState().mission).toEqual({
      status: 'active',
      day: 2,
      phase: 'working',
      speed: 0,
      timeInDayMs: 0,
      report: null,
    });
  });

  it('rozliczenie zachodzi dokładnie raz na dzień', () => {
    const engine = testEngine({ phase: 'workEnded' });
    engine.dispatch({ type: 'SettleDay' });
    const afterFirst = engine.getState();

    expect(engine.dispatch({ type: 'SettleDay' })).toEqual({
      ok: false,
      rejection: { code: 'phaseNotAllowed' },
    });
    expect(engine.getState()).toBe(afterFirst);
  });

  it('po zapisie i wczytaniu rozliczonego dnia nie da się rozliczyć go ponownie', () => {
    const engine = testEngine({ phase: 'workEnded' });
    engine.dispatch({ type: 'SettleDay' });
    const restored = deepFreeze(JSON.parse(JSON.stringify(engine.getState())) as GameState);
    const reloaded = createEngine({ config: DEFAULT_BALANCE, initialState: restored });

    expect(reloaded.dispatch({ type: 'SettleDay' }).ok).toBe(false);
    expect(reloaded.getState().mission.report).toEqual(engine.getState().mission.report);
  });

  it.each([
    ['dzień pracy', { phase: 'working' }, 'SettleDay'],
    ['koniec pracy', { phase: 'workEnded' }, 'StartNextDay'],
    ['dzień pracy', { phase: 'working' }, 'StartNextDay'],
  ] as const)('odrzuca w fazie „%s” polecenie %s', (_, patch, type) => {
    const engine = testEngine(patch);
    const before = engine.getState();

    expect(engine.dispatch({ type })).toEqual({
      ok: false,
      rejection: { code: 'phaseNotAllowed' },
    });
    expect(engine.getState()).toBe(before);
  });

  it('nie przechodzi do następnego dnia, gdy misja się zakończyła', () => {
    const engine = testEngine({ phase: 'settled', status: 'won' });

    expect(engine.dispatch({ type: 'StartNextDay' })).toEqual({
      ok: false,
      rejection: { code: 'missionEnded' },
    });
  });

  it('po zakończeniu pracy symulacja stoi, a krok niczego nie zmienia', () => {
    const engine = testEngine();
    runToEndOfDay(engine);
    const before = engine.getState();

    engine.step();
    expect(engine.dispatch({ type: 'SetSpeed', speed: 4 }).ok).toBe(false);
    expect(engine.getState()).toBe(before);
  });
});

describe('polityka faz poleceń (TIME-08)', () => {
  const phasesOf = (category: CommandCategory): readonly DayPhase[] => PHASES_BY_CATEGORY[category];

  it('po zakończeniu pracy dozwolone są wyłącznie oddanie projektu i rozliczenie', () => {
    const categories = (Object.keys(PHASES_BY_CATEGORY) as CommandCategory[]).filter((c) =>
      phasesOf(c).includes('workEnded'),
    );
    expect(categories.sort()).toEqual(['delivery', 'settlement']);
  });

  it('po rozliczeniu dozwolone jest wyłącznie przejście do następnego dnia', () => {
    const categories = (Object.keys(PHASES_BY_CATEGORY) as CommandCategory[]).filter((c) =>
      phasesOf(c).includes('settled'),
    );
    expect(categories).toEqual(['nextDay']);
  });

  // Strażnik dla przyszłych poleceń: zatrudnianie, zwalnianie, kontrakty i edycja biura
  // muszą należeć do kategorii dnia pracy (TIME-08).
  it('każde polecenie w rejestrze ma kategorię zgodną z oczekiwaną listą', () => {
    const expected: Record<CommandType, CommandCategory> = {
      SetSpeed: 'workDay',
      SettleDay: 'settlement',
      StartNextDay: 'nextDay',
      HireCandidate: 'workDay',
      AssignDesk: 'workDay',
      MoveFurniture: 'workDay',
      SellFurniture: 'workDay',
      BuyFurniture: 'workDay',
    };
    const actual = Object.fromEntries(
      Object.entries(commandHandlers).map(([type, handler]) => [type, handler.category]),
    );
    expect(actual).toEqual(expected);
  });
});
