import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { EVENT_TEMPLATES } from '../domain/content/events';
import { RETRO_CARDS } from '../domain/content/retroCards';
import { SATISFACTION_SCALE } from '../domain/employees';
import type { RetroCardId } from '../domain/scrum';
import type { GameState } from '../domain/state';
import { createPlayer } from '../test/player';
import { readyChapterTwo } from '../test/scrumFixture';
import { createEngine } from './engine';
import { ceremonyMs } from './meetings';
import { activeEffect, drawRetroCards } from './retro';
import { beginScrumDay } from './scrum';
import { bonusPermilleFor } from './work';

const { scrum } = DEFAULT_BALANCE;
const ids = (n: number) => RETRO_CARDS.slice(0, n).map((c) => c.id);

// Rozdział 2 w trakcie sprintu z oczekującym retro (oferta: trzy pierwsze karty).
function withRetro(cards: RetroCardId[] = [], offered = ids(3)): GameState {
  const player = createPlayer(DEFAULT_BALANCE, 1, readyChapterTwo().getState());
  player.finishDay();
  const state = player.state();
  if (!state.scrum) throw new Error('setup');
  return {
    ...state,
    scrum: { ...state.scrum, pendingGoal: false, cards, pendingRetro: { offered } },
  };
}

describe('retrospektywa i karty (SH-056)', () => {
  it('losowanie: trzy różne karty spoza aktywnych, deterministycznie', () => {
    const state = withRetro(ids(2));
    const draw = drawRetroCards(state, DEFAULT_BALANCE);
    expect(draw.offered).toHaveLength(scrum.retroCardsOffered);
    expect(new Set(draw.offered).size).toBe(scrum.retroCardsOffered);
    for (const id of draw.offered) expect(ids(2)).not.toContain(id);
    expect(drawRetroCards(state, DEFAULT_BALANCE)).toEqual(draw);
  });

  it('wybór karty dodaje ją do aktywnych i zamyka retro; drugi wybór odrzucony', () => {
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: withRetro() });
    const [first] = ids(1);
    expect(
      engine.dispatch({ type: 'ChooseRetroCard', cardId: first ?? null, replace: null }),
    ).toEqual({ ok: true });
    expect(engine.getState().scrum).toMatchObject({ cards: [first], pendingRetro: null });
    const before = engine.getState();
    expect(engine.dispatch({ type: 'ChooseRetroCard', cardId: null, replace: null })).toEqual({
      ok: false,
      rejection: { code: 'noPendingRetro' },
    });
    expect(engine.getState()).toBe(before);
  });

  it('przy pełnym limicie trzeba wskazać kartę do zastąpienia; „Pomiń” niczego nie zmienia', () => {
    const active = ids(3);
    const offered = RETRO_CARDS.slice(3, 6).map((c) => c.id);
    const engine = createEngine({
      config: DEFAULT_BALANCE,
      initialState: withRetro(active, offered),
    });
    expect(
      engine.dispatch({ type: 'ChooseRetroCard', cardId: offered[0] ?? null, replace: null }),
    ).toEqual({
      ok: false,
      rejection: { code: 'cardLimit' },
    });
    expect(
      engine.dispatch({
        type: 'ChooseRetroCard',
        cardId: offered[0] ?? null,
        replace: active[1] ?? null,
      }),
    ).toEqual({ ok: true });
    expect(engine.getState().scrum?.cards).toEqual([active[0], active[2], offered[0]]);

    const skip = createEngine({
      config: DEFAULT_BALANCE,
      initialState: withRetro(active, offered),
    });
    expect(skip.dispatch({ type: 'ChooseRetroCard', cardId: null, replace: null })).toEqual({
      ok: true,
    });
    expect(skip.getState().scrum).toMatchObject({ cards: active, pendingRetro: null });
  });

  it('oczekujące retro trzyma pauzę w dniu pracy', () => {
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: withRetro() });
    expect(engine.dispatch({ type: 'SetSpeed', speed: 1 })).toEqual({
      ok: false,
      rejection: { code: 'retroPending' },
    });
  });

  it('efekty kart sumują się', () => {
    const state = withRetro(['definitionOfDone', 'pairProgramming'] as RetroCardId[]);
    expect(activeEffect(state)).toMatchObject({ bugRiskPermille: -800, workPermille: -300 });
  });

  it('tempo pracy i testów: karty zmieniają premię', () => {
    const base = withRetro();
    const project = Object.values(base.contracts.projects).find((p) => p.status === 'active');
    const member = Object.values(base.staff.employees).find((e) => e.projectId === project?.id);
    if (!project || !member) throw new Error('setup');
    const work = bonusPermilleFor(base, member, project.id, DEFAULT_BALANCE);
    const test = bonusPermilleFor(base, member, project.id, DEFAULT_BALANCE, 'test');
    const slow = withRetro(['pairProgramming'] as RetroCardId[]);
    expect(bonusPermilleFor(slow, member, project.id, DEFAULT_BALANCE) - work).toBe(-200);
    const tests = withRetro(['automatedTests'] as RetroCardId[]);
    expect(bonusPermilleFor(tests, member, project.id, DEFAULT_BALANCE, 'test') - test).toBe(250);
  });

  it('długość ceremonii i zadowolenie na początku dnia', () => {
    const timebox = withRetro(['timeboxing'] as RetroCardId[]);
    const sm = { seniority: 'senior' as const };
    expect(ceremonyMs('daily', sm, DEFAULT_BALANCE, timebox)).toBe(
      Math.round((scrum.dailySeconds.senior * 1000 * 0.7) / 100) * 100,
    );
    const fun = withRetro(['foosball'] as RetroCardId[]);
    const next = beginScrumDay(fun, DEFAULT_BALANCE);
    for (const employee of Object.values(next.staff.employees)) {
      const was = fun.staff.employees[employee.id]?.satisfaction ?? 0;
      expect(employee.satisfaction).toBe(
        Math.min(100 * SATISFACTION_SCALE, was + 2 * SATISFACTION_SCALE),
      );
    }
  });

  it('pełny sprint: retro ostatniego dnia kończy się ofertą kart i pauzą', () => {
    const player = createPlayer(DEFAULT_BALANCE, 1, readyChapterTwo().getState());
    player.finishDay();
    const sprint = player.state().scrum?.sprint;
    if (!sprint) throw new Error('brak sprintu');
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: player.state() });
    const goal = Object.values(engine.getState().contracts.projects).find(
      (p) => p.status === 'active',
    );
    engine.dispatch({ type: 'ChooseSprintGoal', projectId: goal?.id ?? null });
    // Do ostatniego dnia sprintu automatem gracza (wybiera karty i cele).
    const runner = createPlayer(DEFAULT_BALANCE, 1, engine.getState());
    while (runner.state().mission.day < sprint.endDay) runner.finishDay();
    const last = createEngine({ config: DEFAULT_BALANCE, initialState: runner.state() });
    last.dispatch({ type: 'SetSpeed', speed: 4 });
    for (let i = 0; i < 20_000 && !last.getState().scrum?.pendingRetro; i++) {
      // Losowe zdarzenia rozstrzygamy pierwszą odpowiedzią (pauzują grę).
      const pending = last.getState().events.pending;
      const option = EVENT_TEMPLATES.find((t) => t.id === pending?.templateId)?.options[0];
      if (option) {
        last.dispatch({ type: 'ResolveEvent', optionId: option.id });
        last.dispatch({ type: 'SetSpeed', speed: 4 });
      }
      last.step();
    }
    const state = last.getState();
    expect(state.scrum?.pendingRetro?.offered).toHaveLength(scrum.retroCardsOffered);
    expect(state.mission.speed).toBe(0);
    expect(state.scrum?.lastCeremony?.ceremony).toBe('retro');
  });
});
