import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { EVENT_TEMPLATES } from '../domain/content/events';
import { MAX_SATISFACTION, SATISFACTION_SCALE } from '../domain/employees';
import type { GameState } from '../domain/state';
import { createInitialState } from '../domain/state';
import { createPlayer } from '../test/player';
import { activeProjectId, readyChapterTwo, withCompletedProject } from '../test/scrumFixture';
import { createEngine } from './engine';
import { goalBonusPermille, scrumMasterOf } from './scrum';

const { scrum } = DEFAULT_BALANCE;

// Koniec dnia i następny dzień (decyzje Scruma zostawione graczowi — bez automatu gracza).
function nextDay(state: GameState): GameState {
  const engine = createEngine({ config: DEFAULT_BALANCE, initialState: state });
  engine.dispatch({ type: 'SetSpeed', speed: 4 });
  for (let i = 0; i < 20_000 && engine.getState().mission.phase !== 'workEnded'; i++) {
    const pending = engine.getState().events.pending;
    const option = EVENT_TEMPLATES.find((t) => t.id === pending?.templateId)?.options[0];
    if (option) engine.dispatch({ type: 'ResolveEvent', optionId: option.id });
    engine.step();
  }
  expect(engine.dispatch({ type: 'SettleDay' })).toEqual({ ok: true });
  expect(engine.dispatch({ type: 'StartNextDay' })).toEqual({ ok: true });
  engine.dispatch({ type: 'SetSpeed', speed: 4 });
  for (let i = 0; i < 2_000 && engine.getState().mission.phase === 'arriving'; i++) engine.step();
  return engine.getState();
}

describe('sprint i cel sprintu (SH-054)', () => {
  it('rozdział 1: brak stanu Scruma', () => {
    expect(createInitialState(DEFAULT_BALANCE, 1).scrum).toBeNull();
  });

  it('bez Scrum Mastera albo bez stołu sprint się nie zaczyna', () => {
    for (const options of [{ scrumMaster: false }, { table: false }]) {
      const next = nextDay(readyChapterTwo(options).getState());
      expect(next.scrum?.sprint, JSON.stringify(options)).toBeNull();
    }
  });

  it('z Scrum Masterem i stołem sprint zaczyna się następnego dnia; o 9:00 pauza na wybór celu', () => {
    const today = readyChapterTwo().getState();
    expect(today.scrum?.sprint).toBeNull();
    const next = nextDay(today);
    expect(next.scrum?.sprint).toEqual({
      number: 1,
      startDay: today.mission.day + 1,
      endDay: today.mission.day + scrum.sprintDays,
      goalProjectId: null,
      goalSettled: false,
    });
    expect(next.scrum?.pendingGoal).toBe(true);
    expect(next.mission).toMatchObject({ phase: 'working', speed: 0 });
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: next });
    expect(engine.dispatch({ type: 'SetSpeed', speed: 1 })).toEqual({
      ok: false,
      rejection: { code: 'sprintGoalPending' },
    });
  });

  it('wybór celu: projekt aktywny albo „bez celu”; drugi wybór odrzucony bez zmian', () => {
    const next = nextDay(readyChapterTwo().getState());
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: next });
    const projectId = activeProjectId(next);
    expect(engine.dispatch({ type: 'ChooseSprintGoal', projectId })).toEqual({ ok: true });
    expect(engine.getState().scrum).toMatchObject({
      pendingGoal: false,
      sprint: { goalProjectId: projectId },
    });
    const before = engine.getState();
    expect(engine.dispatch({ type: 'ChooseSprintGoal', projectId: null })).toEqual({
      ok: false,
      rejection: { code: 'noPendingGoal' },
    });
    expect(engine.getState()).toBe(before);

    const noGoal = createEngine({ config: DEFAULT_BALANCE, initialState: next });
    expect(noGoal.dispatch({ type: 'ChooseSprintGoal', projectId: null })).toEqual({ ok: true });
    expect(noGoal.getState().scrum?.sprint?.goalProjectId).toBeNull();
  });

  it('premia celu tylko dla projektu-celu', () => {
    const next = nextDay(readyChapterTwo().getState());
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: next });
    const projectId = activeProjectId(next);
    engine.dispatch({ type: 'ChooseSprintGoal', projectId });
    expect(goalBonusPermille(engine.getState(), projectId, DEFAULT_BALANCE)).toBe(
      scrum.goalBonusPermille,
    );
    expect(goalBonusPermille(next, projectId, DEFAULT_BALANCE)).toBe(0);
  });

  it('oddanie celu w sprincie: premia reputacji i zadowolenia dokładnie raz', () => {
    const next = nextDay(readyChapterTwo().getState());
    const projectId = activeProjectId(next);
    const chosen = createEngine({ config: DEFAULT_BALANCE, initialState: next });
    chosen.dispatch({ type: 'ChooseSprintGoal', projectId });
    const ready = withCompletedProject(chosen.getState(), projectId);
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: ready });
    const before = engine.getState();
    expect(engine.dispatch({ type: 'DeliverProject', projectId })).toEqual({ ok: true });
    const after = engine.getState();
    expect(after.scrum?.sprint?.goalSettled).toBe(true);
    // Reputacja z oddania (jakość, termin) + premia celu.
    const withoutGoal = createEngine({
      config: DEFAULT_BALANCE,
      initialState: {
        ...ready,
        scrum: ready.scrum && {
          ...ready.scrum,
          sprint: ready.scrum.sprint && { ...ready.scrum.sprint, goalProjectId: null },
        },
      },
    });
    withoutGoal.dispatch({ type: 'DeliverProject', projectId });
    expect(after.mission.reputation - withoutGoal.getState().mission.reputation).toBe(
      scrum.goalSuccess.reputation,
    );
    for (const employee of Object.values(after.staff.employees)) {
      const was = before.staff.employees[employee.id]?.satisfaction ?? 0;
      expect(employee.satisfaction).toBe(
        Math.min(MAX_SATISFACTION, was + scrum.goalSuccess.satisfaction * SATISFACTION_SCALE),
      );
    }
  });

  it('koniec sprintu bez oddania celu: kara raz; kolejny sprint od następnego dnia', () => {
    const next = nextDay(readyChapterTwo().getState());
    const projectId = activeProjectId(next);
    // Dwa przebiegi z tego samego stanu: z celem i bez — różnią się tylko rozliczeniem celu.
    const run = (goal: typeof projectId | null) => {
      const engine = createEngine({ config: DEFAULT_BALANCE, initialState: next });
      engine.dispatch({ type: 'ChooseSprintGoal', projectId: goal });
      let state = engine.getState();
      const sprint = state.scrum?.sprint;
      if (!sprint) throw new Error('brak sprintu');
      while (state.mission.day <= sprint.endDay) {
        // Pomijamy retro i kolejne wybory celu — tylko rozliczenie celu.
        const scrum = state.scrum && { ...state.scrum, pendingGoal: false, pendingRetro: null };
        state = nextDay({ ...state, scrum });
      }
      return { state, sprint };
    };
    const withGoal = run(projectId);
    const withoutGoal = run(null);
    expect(withGoal.state.mission.reputation - withoutGoal.state.mission.reputation).toBe(
      scrum.goalFailure.reputation,
    );
    expect(withGoal.state.scrum?.sprint).toMatchObject({
      number: 2,
      startDay: withGoal.sprint.endDay + 1,
      goalProjectId: null,
    });
  });

  it('utrata Scrum Mastera przerywa sprint bez rozliczenia celu', () => {
    const next = nextDay(readyChapterTwo().getState());
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: next });
    engine.dispatch({ type: 'ChooseSprintGoal', projectId: activeProjectId(next) });
    const sm = scrumMasterOf(engine.getState());
    if (!sm) throw new Error('brak SM');
    engine.dispatch({ type: 'FireEmployee', employeeId: sm.id });
    const reputation = engine.getState().mission.reputation;
    const after = nextDay(engine.getState());
    expect(after.scrum?.sprint).toBeNull();
    expect(after.mission.reputation).toBe(reputation);
  });

  it('automat gracza testowego wybiera cel i gra dalej', () => {
    const player = createPlayer(DEFAULT_BALANCE, 1, readyChapterTwo().getState());
    player.finishDay();
    player.finishDay();
    expect(player.state().scrum?.sprint?.number).toBe(1);
  });
});
