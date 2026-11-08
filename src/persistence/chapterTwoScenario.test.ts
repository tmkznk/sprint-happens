import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { EVENT_TEMPLATES } from '../domain/content/events';
import type { GameState } from '../domain/state';
import { createEngine, type Engine } from '../simulation/engine';
import { activeProjectId, readyChapterTwo, withCompletedProject } from '../test/scrumFixture';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import type { ValidationContext } from './schema';
import { parseSnapshot, serializeSnapshot } from './snapshot';

// SH-060: scenariusz rozdziału 2 — przejście (wygrany rozdział 1 → przeprowadzka), Scrum Master
// i stół, pełny sprint z celem, daily i retro, oddanie projektu; zapis w trakcie ceremonii;
// determinizm. Decyzje gracza: pierwszy projekt jako cel, pierwsza karta, pierwsza odpowiedź.
const context: ValidationContext = { config: DEFAULT_BALANCE, layout: OFFICE_LAYOUT };

function roundTrip(state: GameState): GameState {
  const json = serializeSnapshot(
    state,
    { gameBuildVersion: 'test', revision: 1, savedAt: '2026-11-08T12:00:00.000Z' },
    context,
  );
  if (!json.ok) throw new Error(json.error.issues.join('\n'));
  const parsed = parseSnapshot(json.json, context);
  if (!parsed.ok) throw new Error(parsed.error.issues.join('\n'));
  return parsed.envelope.state;
}

// Jeden krok gracza: decyzje (zdarzenie, cel, retro), wznowienie, krok, rozliczenie, następny dzień.
function tick(engine: Engine): void {
  const state = engine.getState();
  const pending = state.events.pending;
  const option = EVENT_TEMPLATES.find((t) => t.id === pending?.templateId)?.options[0];
  if (option) engine.dispatch({ type: 'ResolveEvent', optionId: option.id });
  if (state.scrum?.pendingGoal && state.mission.phase === 'working') {
    engine.dispatch({ type: 'ChooseSprintGoal', projectId: activeProjectId(state) });
  }
  const retro = state.scrum?.pendingRetro;
  if (retro) {
    const full = (state.scrum?.cards.length ?? 0) >= DEFAULT_BALANCE.scrum.cardLimit;
    engine.dispatch({
      type: 'ChooseRetroCard',
      cardId: retro.offered[0] ?? null,
      replace: full ? (state.scrum?.cards[0] ?? null) : null,
    });
  }
  const phase = engine.getState().mission.phase;
  if (phase === 'workEnded') engine.dispatch({ type: 'SettleDay' });
  else if (phase === 'settled') engine.dispatch({ type: 'StartNextDay' });
  else {
    if (engine.getState().mission.speed === 0) engine.dispatch({ type: 'SetSpeed', speed: 4 });
    engine.step();
  }
}

function playUntil(engine: Engine, done: (state: GameState) => boolean, max = 200_000): void {
  for (let i = 0; i < max && !done(engine.getState()); i++) tick(engine);
  expect(done(engine.getState())).toBe(true);
}

describe('scenariusz rozdziału 2 (SH-060)', () => {
  it('pełny sprint: planowanie, daily, retro z kartą; oddanie celu; zapis w trakcie ceremonii', () => {
    const engine = readyChapterTwo();
    // Sprint startuje następnego dnia; planowanie z celem.
    playUntil(engine, (s) => s.scrum?.lastCeremony?.ceremony === 'planning');
    const sprint = engine.getState().scrum?.sprint;
    if (!sprint) throw new Error('brak sprintu');
    expect(sprint.goalProjectId).not.toBeNull();

    // Zapis w połowie daily: odtworzony stan kończy spotkanie identycznie.
    playUntil(
      engine,
      (s) => s.scrum?.meeting?.ceremony === 'daily' && s.scrum.meeting.untilMs !== null,
    );
    const restored = createEngine({
      config: DEFAULT_BALANCE,
      initialState: roundTrip(engine.getState()),
    });
    playUntil(engine, (s) => s.scrum?.meeting === null);
    playUntil(restored, (s) => s.scrum?.meeting === null);
    expect(restored.getState()).toEqual(engine.getState());

    // Oddanie celu w trakcie sprintu (technika ukończona wprost): premia raz.
    const goal = sprint.goalProjectId;
    if (!goal) throw new Error('brak celu');
    const ready = createEngine({
      config: DEFAULT_BALANCE,
      initialState: withCompletedProject(engine.getState(), goal),
    });
    expect(ready.dispatch({ type: 'DeliverProject', projectId: goal })).toEqual({ ok: true });
    expect(ready.getState().scrum?.sprint?.goalSettled).toBe(true);
    expect(ready.getState().contracts.chapterDeliveredCount).toBe(1);

    // Retro ostatniego dnia: zapis z oczekującą ofertą, wybór karty po wczytaniu.
    playUntil(ready, (s) => !!s.scrum?.pendingRetro);
    const withOffer = roundTrip(ready.getState());
    expect(withOffer.scrum?.pendingRetro).toEqual(ready.getState().scrum?.pendingRetro);
    const after = createEngine({ config: DEFAULT_BALANCE, initialState: withOffer });
    tick(after);
    expect(after.getState().scrum?.cards).toHaveLength(1);
    expect(after.getState().scrum?.pendingRetro).toBeNull();

    // Następny sprint startuje dzień po końcu poprzedniego.
    playUntil(after, (s) => (s.scrum?.sprint?.number ?? 0) === 2);
    expect(after.getState().scrum?.sprint?.startDay).toBe(sprint.endDay + 1);
  });

  it('determinizm: ten sam stan i te same decyzje dają identyczny wynik po pełnym sprincie', () => {
    const run = () => {
      const engine = readyChapterTwo();
      playUntil(engine, (s) => (s.scrum?.sprint?.number ?? 0) === 2);
      return engine.getState();
    };
    expect(run()).toEqual(run());
  });
});
