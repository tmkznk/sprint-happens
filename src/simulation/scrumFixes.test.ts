import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { EVENT_TEMPLATES } from '../domain/content/events';
import type { RetroCardId } from '../domain/scrum';
import type { GameState } from '../domain/state';
import { createPlayer } from '../test/player';
import { readyChapterTwo } from '../test/scrumFixture';
import { createEngine, type Engine } from './engine';
import { standingSpots } from './meetings';
import { activeEffect } from './retro';
import { scrumMasterOf } from './scrum';

function play(engine: Engine, done: (s: GameState) => boolean, max = 20_000) {
  for (let i = 0; i < max && !done(engine.getState()); i++) {
    const pending = engine.getState().events.pending;
    const option = EVENT_TEMPLATES.find((t) => t.id === pending?.templateId)?.options[0];
    if (option) engine.dispatch({ type: 'ResolveEvent', optionId: option.id });
    if (engine.getState().mission.speed === 0 && !engine.getState().scrum?.pendingRetro) {
      engine.dispatch({ type: 'SetSpeed', speed: 4 });
    }
    engine.step();
  }
}

// Pierwszy dzień sprintu z celem, w trakcie dnia (automat gracza).
function sprintEngine(seniority: 'junior' | 'mid' | 'senior' = 'senior'): Engine {
  const player = createPlayer(DEFAULT_BALANCE, 1, readyChapterTwo({ seniority }).getState());
  player.finishDay();
  const engine = createEngine({ config: DEFAULT_BALANCE, initialState: player.state() });
  const goal = Object.values(engine.getState().contracts.projects).find(
    (p) => p.status === 'active',
  );
  engine.dispatch({ type: 'ChooseSprintGoal', projectId: goal?.id ?? null });
  engine.dispatch({ type: 'SetSpeed', speed: 4 });
  return engine;
}

describe('poprawki po recenzji Scruma', () => {
  it('junior Scrum Master: retro ostatniego dnia mieści się przed 17:00 i kończy ofertą kart', () => {
    const start = sprintEngine('junior');
    const end = start.getState().scrum?.sprint?.endDay ?? 0;
    const runner = createPlayer(DEFAULT_BALANCE, 1, start.getState());
    while (runner.state().mission.day < end) runner.finishDay();
    const last = createEngine({ config: DEFAULT_BALANCE, initialState: runner.state() });
    play(last, (s) => !!s.scrum?.pendingRetro || s.mission.phase !== 'working');
    expect(last.getState().scrum?.pendingRetro?.offered.length).toBe(
      DEFAULT_BALANCE.scrum.retroCardsOffered,
    );
  });

  it('miejsca stojące tylko na wolnej podłodze (stół przy ścianie)', () => {
    const engine = sprintEngine();
    const state = engine.getState();
    const table = Object.values(state.world.furniture).find((f) => f.type === 'conferenceTable');
    if (!table) throw new Error('brak stołu');
    // Stół przy tylnej ścianie salki (9,1): narożniki i krótszy bok y = 0 to ściana.
    const spots = standingSpots(state, table);
    expect(spots.length).toBeLessThan(8);
    for (const spot of spots) expect(spot.cell.y).toBeGreaterThanOrEqual(1);
  });

  it('rozkaz w trakcie spotkania wyłącza osobę ze spotkania (bez premii), nie wraca do stołu', () => {
    const engine = sprintEngine();
    play(engine, (s) => s.scrum?.meeting?.untilMs != null);
    engine.dispatch({ type: 'SetSpeed', speed: 0 });
    const meeting = engine.getState().scrum?.meeting;
    const sm = scrumMasterOf(engine.getState());
    const member = meeting?.participants.find((id) => id !== sm?.id);
    if (!member) throw new Error('setup');
    expect(
      engine.dispatch({
        type: 'OrderEmployee',
        employeeId: member,
        target: { kind: 'cell', cell: { x: 4, y: 12 } },
      }),
    ).toEqual({ ok: true });
    expect(engine.getState().scrum?.meeting?.participants).not.toContain(member);
    play(engine, (s) => s.scrum?.meeting === null);
    expect(engine.getState().scrum?.dailyBonus?.employees).not.toContain(member);
  });

  it('bez Scrum Mastera karty retro nie działają', () => {
    const engine = sprintEngine();
    const state = engine.getState();
    if (!state.scrum) throw new Error('setup');
    const withCards: GameState = {
      ...state,
      scrum: { ...state.scrum, cards: ['pairProgramming' as RetroCardId] },
    };
    expect(activeEffect(withCards).workPermille).toBe(-200);
    const sm = scrumMasterOf(withCards);
    if (!sm) throw new Error('setup');
    const rest = Object.fromEntries(
      Object.entries(withCards.staff.employees).filter(([id]) => id !== sm.id),
    ) as GameState['staff']['employees'];
    expect(
      activeEffect({ ...withCards, staff: { ...withCards.staff, employees: rest } }).workPermille,
    ).toBe(0);
  });

  it('sprzedaż biurka Scrum Mastera nie kasuje sprintu', () => {
    const engine = sprintEngine();
    engine.dispatch({ type: 'SetSpeed', speed: 0 });
    const sm = scrumMasterOf(engine.getState());
    if (!sm?.deskId) throw new Error('setup');
    expect(engine.dispatch({ type: 'SellFurniture', furnitureId: sm.deskId })).toEqual({
      ok: true,
    });
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    for (let i = 0; i < 50; i++) engine.step();
    expect(engine.getState().scrum?.sprint).not.toBeNull();
  });
});
