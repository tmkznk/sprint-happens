import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { EVENT_TEMPLATES } from '../domain/content/events';
import type { GameState } from '../domain/state';
import { createPlayer } from '../test/player';
import { readyChapterTwo } from '../test/scrumFixture';
import { createEngine, type Engine } from './engine';
import { eventAvailableInChapter } from './events';
import { ceremonyMs, meetingSeating } from './meetings';
import { scrumMasterOf } from './scrum';

const { scrum } = DEFAULT_BALANCE;

// Pierwszy dzień sprintu po wyborze celu (pierwszy aktywny projekt), 9:00, pauza.
function sprintDayOne(): Engine {
  const player = createPlayer(DEFAULT_BALANCE, 1, readyChapterTwo().getState());
  player.finishDay();
  const engine = createEngine({ config: DEFAULT_BALANCE, initialState: player.state() });
  const project = Object.values(engine.getState().contracts.projects).find(
    (p) => p.status === 'active',
  );
  engine.dispatch({ type: 'ChooseSprintGoal', projectId: project?.id ?? null });
  engine.dispatch({ type: 'SetSpeed', speed: 4 });
  return engine;
}

function stepUntil(engine: Engine, done: (state: GameState) => boolean, max = 20_000) {
  for (let i = 0; i < max && !done(engine.getState()); i++) engine.step();
  expect(done(engine.getState())).toBe(true);
}

const seatedAtTable = (state: GameState) =>
  state.world.movement.agents.filter(
    (a) =>
      a.status === 'using' &&
      a.reservedDestination !== null &&
      state.world.furniture[a.reservedDestination.split('#')[0] as never]?.type ===
        'conferenceTable',
  );

describe('spotkania przy stole (SH-055)', () => {
  it('przed 10:00 nie ma spotkania; o 10:00 pierwszego dnia sprintu — planowanie', () => {
    const engine = sprintDayOne();
    stepUntil(engine, (s) => s.mission.timeInDayMs >= scrum.ceremonyAtMs - 1_000);
    expect(engine.getState().scrum?.meeting).toBeNull();
    stepUntil(engine, (s) => s.scrum?.meeting !== null);
    const { meeting } = engine.getState().scrum ?? {};
    expect(meeting?.ceremony).toBe('planning');
    expect(engine.getState().mission.timeInDayMs).toBeGreaterThanOrEqual(scrum.ceremonyAtMs);
  });

  it('uczestnicy (Scrum Master i osoby z przydziałem) siadają przy stole; w trakcie brak pracy i zużycia energii', () => {
    const engine = sprintDayOne();
    stepUntil(engine, (s) => s.scrum?.meeting?.untilMs != null);
    const state = engine.getState();
    const participants = state.scrum?.meeting?.participants ?? [];
    const sm = scrumMasterOf(state);
    const assigned = Object.values(state.staff.employees).filter((e) => e.projectId !== null);
    expect([...participants].sort()).toEqual([sm?.id, ...assigned.map((e) => e.id)].sort());
    stepUntil(engine, (s) => seatedAtTable(s).length === participants.length);
    const before = engine.getState();
    const project = Object.values(before.contracts.projects).find((p) => p.status === 'active');
    for (let i = 0; i < 20; i++) engine.step();
    const after = engine.getState();
    expect(after.scrum?.meeting).not.toBeNull();
    expect(after.contracts.projects[project?.id as never]).toEqual(
      before.contracts.projects[project?.id as never],
    );
    for (const id of participants) {
      expect(after.staff.employees[id]?.energy).toBe(before.staff.employees[id]?.energy);
    }
  });

  it('planowanie trwa wg seniority Scrum Mastera; po nim premia dnia dla uczestników, nie dla innych', () => {
    const engine = sprintDayOne();
    stepUntil(engine, (s) => s.scrum?.meeting?.untilMs != null);
    const started = engine.getState().mission.timeInDayMs;
    const sm = scrumMasterOf(engine.getState());
    if (!sm) throw new Error('brak SM');
    expect((engine.getState().scrum?.meeting?.untilMs ?? 0) - started).toBe(
      ceremonyMs('planning', sm, DEFAULT_BALANCE),
    );
    stepUntil(engine, (s) => s.scrum?.meeting === null);
    const state = engine.getState();
    expect(state.scrum?.lastCeremony).toEqual({ day: state.mission.day, ceremony: 'planning' });
    expect(state.scrum?.dailyBonus?.day).toBe(state.mission.day);
    const qa = Object.values(state.staff.employees).find(
      (e) => e.projectId === null && e.specialization === 'qa',
    );
    expect(state.scrum?.dailyBonus?.employees).not.toContain(qa?.id);
    expect(seatedAtTable(state)).toHaveLength(0);
  });

  it('daily: junior prowadzi dłużej niż senior; planowanie ×2', () => {
    const base = { specialization: 'scrumMaster' as const };
    const junior = ceremonyMs('daily', { ...base, seniority: 'junior' }, DEFAULT_BALANCE);
    const senior = ceremonyMs('daily', { ...base, seniority: 'senior' }, DEFAULT_BALANCE);
    expect(junior).toBe(scrum.dailySeconds.junior * 1000);
    expect(senior).toBe(scrum.dailySeconds.senior * 1000);
    expect(ceremonyMs('planning', { ...base, seniority: 'mid' }, DEFAULT_BALANCE)).toBe(
      scrum.dailySeconds.mid * 1000 * scrum.planningFactor,
    );
  });

  it('miejsca: najpierw siedzące, potem stojące; kto się nie zmieści, nie idzie', () => {
    expect(meetingSeating(3, 8, 8)).toEqual({ seated: 3, standing: 0, left: 0 });
    expect(meetingSeating(12, 8, 8)).toEqual({ seated: 8, standing: 4, left: 0 });
    expect(meetingSeating(19, 8, 8)).toEqual({ seated: 8, standing: 8, left: 3 });
  });

  it('zwolnienie Scrum Mastera w trakcie spotkania: koniec spotkania i sprintu, bez premii', () => {
    const engine = sprintDayOne();
    stepUntil(engine, (s) => s.scrum?.meeting?.untilMs != null);
    engine.dispatch({ type: 'SetSpeed', speed: 0 });
    const sm = scrumMasterOf(engine.getState());
    if (!sm) throw new Error('brak SM');
    expect(engine.dispatch({ type: 'FireEmployee', employeeId: sm.id })).toEqual({ ok: true });
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    engine.step();
    const state = engine.getState();
    expect(state.scrum).toMatchObject({ meeting: null, sprint: null, dailyBonus: null });
    for (let i = 0; i < 400; i++) engine.step();
    expect(seatedAtTable(engine.getState())).toHaveLength(0);
  });

  it('zdarzenie „daily” z rozdziału 1 nie występuje w rozdziale 2', () => {
    const daily = EVENT_TEMPLATES.find((t) => t.id === 'daily-meeting');
    if (!daily) throw new Error('brak szablonu');
    expect(eventAvailableInChapter(daily, 1)).toBe(true);
    expect(eventAvailableInChapter(daily, 2)).toBe(false);
  });

  it('tempo nie zmienia przebiegu: te same kroki przy 1× i 4× dają ten sam stan', () => {
    const a = sprintDayOne();
    const b = sprintDayOne();
    a.dispatch({ type: 'SetSpeed', speed: 1 });
    for (let i = 0; i < 1_500; i++) {
      a.step();
      b.step();
    }
    expect({ ...a.getState(), mission: { ...a.getState().mission, speed: 4 } }).toEqual(
      b.getState(),
    );
  });
});
