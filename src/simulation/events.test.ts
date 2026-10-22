import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { EVENT_TEMPLATES } from '../domain/content/events';
import { POINT_SCALE, type Fragment, type Project, type ProjectId } from '../domain/contracts';
import { SATISFACTION_SCALE, type EmployeeId } from '../domain/employees';
import { seedRng } from '../domain/random';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testState } from '../test/engineFixture';
import { fragmentSize } from './bugs';
import { createEngine } from './engine';
import {
  applyEffects,
  isCoffeeBroken,
  isInMeeting,
  scheduleDay,
  scopeIncrease,
  triggerEvent,
} from './events';
import { advanceStep } from './step';
import { DAY_LENGTH_MS } from './time';
import { planWork } from './work';

const CONFIG = DEFAULT_BALANCE;
const P1 = 'project-1' as ProjectId;
const STEP = CONFIG.simulation.stepMs;

// Dzień 5, przyjęty projekt startowy (frontend 60, backend 40), dwie osoby w zespole.
function base(): GameState {
  const engine = createEngine({ config: CONFIG, initialState: testState() });
  const starter = engine.getState().contracts.offers[0];
  if (starter) engine.dispatch({ type: 'AcceptOffer', offerId: starter.id });
  for (const spec of ['frontend', 'backend'] as const) {
    const candidate = engine
      .getState()
      .staff.candidates.find((c) => c.specialization === spec && c.seniority === 'mid');
    if (!candidate) throw new Error('brak kandydata');
    engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
    const id = Object.values(engine.getState().staff.employees).at(-1)?.id as EmployeeId;
    engine.dispatch({ type: 'AssignProject', employeeId: id, projectId: P1 });
  }
  engine.dispatch({ type: 'SetSpeed', speed: 2 });
  const state = engine.getState();
  return deepFreeze({ ...state, mission: { ...state.mission, day: 5 } });
}

function withEvents(state: GameState, events: Partial<GameState['events']>): GameState {
  return deepFreeze({ ...state, events: { ...state.events, ...events } });
}

const project = (state: GameState) => state.contracts.projects[P1] as Project;

describe('planowanie zdarzeń (EVT-03, SH-032 A7b)', () => {
  it('pierwsze dwa dni bez zdarzeń', () => {
    for (const day of [1, 2]) {
      const state = testState({ day });
      for (let seed = 0; seed < 50; seed++) {
        expect(
          scheduleDay({ ...state, rng: seedRng(seed) }, CONFIG).events.scheduledAtMs,
        ).toBeNull();
      }
    }
  });

  it('ok. 35% dni ze zdarzeniem; chwila w drugiej i trzeciej ćwiartce dnia, wyrównana do kroku', () => {
    const state = testState({ day: 4 });
    let scheduled = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const at = scheduleDay({ ...state, rng: seedRng(seed) }, CONFIG).events.scheduledAtMs;
      if (at === null) continue;
      scheduled++;
      expect(at).toBeGreaterThanOrEqual(DAY_LENGTH_MS / 4);
      expect(at).toBeLessThan((3 * DAY_LENGTH_MS) / 4);
      expect(at % STEP).toBe(0);
    }
    expect(scheduled / 1000).toBeGreaterThan(0.3);
    expect(scheduled / 1000).toBeLessThan(0.4);
  });

  it('nowy dzień planuje zdarzenie i kasuje skutki trwające z poprzedniego', () => {
    const state = withEvents(testState({ day: 3, phase: 'settled', report: null }), {
      meetingUntilMs: 1000,
    });
    const engine = createEngine({
      config: CONFIG,
      initialState: deepFreeze({
        ...state,
        mission: {
          ...state.mission,
          report: {
            day: 3,
            income: 0,
            spending: 0,
            wages: 0,
            upkeep: 0,
            cashAfterSettlement: 0,
            rescueDeadlineDay: null,
          },
        },
      }),
    });
    engine.dispatch({ type: 'StartNextDay' });
    expect(engine.getState().events.meetingUntilMs).toBeNull();
    expect(engine.getState().rng).not.toBe(state.rng);
  });
});

describe('wystąpienie i decyzja (EVT-02)', () => {
  it('w zaplanowanej chwili: pauza, oczekująca decyzja, zapamiętane tempo, najwyżej raz dziennie', () => {
    const start = base();
    const at = start.mission.timeInDayMs + STEP;
    const state = advanceStep(withEvents(start, { scheduledAtMs: at }), CONFIG);

    expect(state.mission.speed).toBe(0);
    expect(state.events.pending).toMatchObject({ instanceId: 'event-1', resumeSpeed: 2 });
    expect(state.events.scheduledAtMs).toBeNull();
    const template = state.events.pending?.templateId ?? '';
    expect(state.events.lastSeenDay[template]).toBe(5);
    expect(triggerEvent(state, CONFIG)).toBe(state);
  });

  it('bez spełnionych warunków dzień mija bez zdarzenia', () => {
    const empty = testState({ day: 5, timeInDayMs: 1000 });
    const state = triggerEvent(
      withEvents(
        deepFreeze({
          ...empty,
          finance: { ...empty.finance, cash: -1, openingCash: -1 },
          world: {
            ...empty.world,
            furniture: Object.fromEntries(
              Object.entries(empty.world.furniture).filter(([, f]) => f.type !== 'coffeeMachine'),
            ),
          },
        }),
        { scheduledAtMs: 500 },
      ),
      CONFIG,
    );
    expect(state.events.pending).toBeNull();
    expect(state.events.scheduledAtMs).toBeNull();
  });

  it('to samo zdarzenie nie częściej niż co 5 dni', () => {
    const start = base();
    const recent = Object.fromEntries(EVENT_TEMPLATES.map((t) => [t.id, 2]));
    const blocked = triggerEvent(
      withEvents(start, { scheduledAtMs: 0, lastSeenDay: recent }),
      CONFIG,
    );
    expect(blocked.events.pending).toBeNull();
    const allowed = triggerEvent(
      withEvents(start, {
        scheduledAtMs: 0,
        lastSeenDay: Object.fromEntries(EVENT_TEMPLATES.map((t) => [t.id, 0])),
      }),
      CONFIG,
    );
    expect(allowed.events.pending).not.toBeNull();
  });

  it('gra nie wznawia się przed wyborem; wybór stosuje skutki raz i przywraca tempo', () => {
    const start = base();
    const pending = withEvents(deepFreeze({ ...start, mission: { ...start.mission, speed: 0 } }), {
      pending: {
        instanceId: 'event-1',
        templateId: 'framework-conference',
        projectId: null,
        resumeSpeed: 2,
      },
    });
    const engine = createEngine({ config: CONFIG, initialState: pending });
    expect(engine.dispatch({ type: 'SetSpeed', speed: 1 })).toEqual({
      ok: false,
      rejection: { code: 'eventPending' },
    });
    expect(engine.dispatch({ type: 'ResolveEvent', optionId: 'nope' })).toEqual({
      ok: false,
      rejection: { code: 'unknownEventOption' },
    });

    expect(engine.dispatch({ type: 'ResolveEvent', optionId: 'send' })).toEqual({ ok: true });
    const after = engine.getState();
    expect(after.finance.cash).toBe(start.finance.cash - 1500);
    expect(after.mission.reputation).toBe(start.mission.reputation + 3);
    expect(after.mission.speed).toBe(2);
    expect(after.events.pending).toBeNull();
    expect(engine.dispatch({ type: 'ResolveEvent', optionId: 'send' })).toEqual({
      ok: false,
      rejection: { code: 'noPendingEvent' },
    });
    expect(engine.getState().finance.ledger.filter((e) => e.kind === 'event')).toHaveLength(1);
  });

  it('wynik zdarzeń jest deterministyczny dla ziarna', () => {
    const play = () => {
      const start = withEvents(base(), { scheduledAtMs: 0 });
      return triggerEvent(start, CONFIG).events.pending;
    };
    expect(play()).toEqual(play());
  });
});

describe('skutki (SH-032 A7)', () => {
  it('„Mała zmiana” płatnie: +25% zakresu FE (do fragmentu), wynagrodzenie +20%, termin +1', () => {
    const start = base();
    const paid = EVENT_TEMPLATES.find((t) => t.id === 'small-change')?.options[1];
    const after = applyEffects(start, paid?.effects ?? [], P1, 'event-1', CONFIG);
    expect(scopeIncrease(60, 25, CONFIG)).toBe(20);
    expect(project(after).scopes.frontend).toBe(80);
    expect(project(after).reward).toBe(Math.round(project(start).reward * 1.2));
    expect(project(after).advance).toBe(project(start).advance);
    expect(project(after).deadlineDay).toBe(project(start).deadlineDay + 1);
    expect(project(after).deadlineDays).toBe(project(start).deadlineDays + 1);
  });

  it('„A może jednak mobile?”: nowy zakres Mobile bez postępu', () => {
    const start = base();
    const yes = EVENT_TEMPLATES.find((t) => t.id === 'maybe-mobile')?.options[0];
    const after = applyEffects(start, yes?.effects ?? [], P1, 'event-1', CONFIG);
    expect(project(after).scopes.mobile).toBe(80);
    expect(project(after).progress.mobile).toBe(0);
  });

  it('zebranie wstrzymuje pracę na 30 s gry', () => {
    const start = base();
    const meeting = applyEffects(
      start,
      [{ kind: 'meeting', seconds: 30 }],
      null,
      'event-1',
      CONFIG,
    );
    expect(isInMeeting(meeting)).toBe(true);
    expect(planWork(meeting, CONFIG).size).toBe(0);
    const later = deepFreeze({
      ...meeting,
      mission: { ...meeting.mission, timeInDayMs: meeting.mission.timeInDayMs + 30_000 },
    });
    expect(isInMeeting(later)).toBe(false);
  });

  it('zadowolenie wszystkich −5; ekspres zepsuty do końca dnia', () => {
    const start = base();
    const after = applyEffects(
      start,
      [{ kind: 'satisfactionAll', delta: -5 }, { kind: 'coffeeBroken' }],
      null,
      'event-1',
      CONFIG,
    );
    for (const e of Object.values(after.staff.employees)) {
      expect(e.satisfaction).toBe(65 * SATISFACTION_SCALE);
    }
    expect(isCoffeeBroken(after)).toBe(true);
    expect(isCoffeeBroken({ ...after, mission: { ...after.mission, day: 6 } })).toBe(false);
  });

  it('audyt ujawnia do 2 ukrytych błędów Backend (jak po testach)', () => {
    const start = base();
    const size = fragmentSize(CONFIG);
    const fragments: Fragment[] = Array.from({ length: 4 }, (_, i) => ({
      specialization: 'backend',
      hasBug: i !== 1,
      testProgress: 0,
      repairProgress: 0,
    }));
    const withBugs = deepFreeze({
      ...start,
      contracts: {
        ...start.contracts,
        projects: {
          ...start.contracts.projects,
          [P1]: { ...project(start), progress: { backend: 40 * POINT_SCALE }, fragments },
        },
      },
    });
    const after = applyEffects(
      withBugs,
      [{ kind: 'revealBugs', specialization: 'backend', count: 2 }],
      P1,
      'event-1',
      CONFIG,
    );
    expect(project(after).fragments.map((f) => f.testProgress)).toEqual([size, 0, size, 0]);
  });

  it('każdy szablon ma co najmniej dwie odpowiedzi i unikalne ID', () => {
    const ids = new Set(EVENT_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(EVENT_TEMPLATES.length);
    for (const template of EVENT_TEMPLATES) {
      expect(template.options.length).toBeGreaterThanOrEqual(2);
    }
  });
});
