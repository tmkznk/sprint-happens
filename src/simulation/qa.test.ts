import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { Fragment, ProjectId } from '../domain/contracts';
import type { Employee, EmployeeId, Seniority, Specialization } from '../domain/employees';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testState } from '../test/engineFixture';
import { workStatus } from './assignments';
import { fragmentSize } from './bugs';
import { createEngine } from './engine';
import { detectedBugCount, doTesting, isTesting, testCoverage, testPerStep } from './qa';
import { isAtOwnDesk } from './work';

const CONFIG = { ...DEFAULT_BALANCE, energy: { ...DEFAULT_BALANCE.energy, drainPerSecond: 0 } };
const P1 = 'project-1' as ProjectId;
const SIZE = fragmentSize(CONFIG);

// Zatrudnia osoby, przypisuje je do projektu startowego i czeka, aż usiądą przy biurkach.
function seated(roles: [Specialization, Seniority][]): { state: GameState; ids: EmployeeId[] } {
  const engine = createEngine({ config: CONFIG, initialState: testState() });
  const starter = engine.getState().contracts.offers[0];
  if (starter) engine.dispatch({ type: 'AcceptOffer', offerId: starter.id });
  const ids: EmployeeId[] = [];
  for (const [specialization, seniority] of roles) {
    const candidate = engine
      .getState()
      .staff.candidates.find(
        (c) => c.specialization === specialization && c.seniority === seniority,
      );
    if (!candidate) throw new Error('brak kandydata');
    engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
    const id = Object.values(engine.getState().staff.employees).at(-1)?.id as EmployeeId;
    engine.dispatch({ type: 'AssignProject', employeeId: id, projectId: P1 });
    ids.push(id);
  }
  engine.dispatch({ type: 'SetSpeed', speed: 1 });
  const atDesk = () =>
    ids.every((id) =>
      isAtOwnDesk(engine.getState(), engine.getState().staff.employees[id] as Employee),
    );
  for (let i = 0; i < 400 && !atDesk(); i++) engine.step();
  if (!atDesk()) throw new Error('pracownicy nie dotarli do biurek');
  return { state: engine.getState(), ids };
}

// Podmienia wykonaną pracę projektu na `count` ukończonych fragmentów frontendu.
function withFragments(state: GameState, fragments: Partial<Fragment>[]): GameState {
  const project = state.contracts.projects[P1];
  if (!project) throw new Error('brak projektu');
  const full = fragments.map((f) => ({
    specialization: 'frontend' as const,
    hasBug: false,
    testProgress: 0,
    ...f,
  }));
  return deepFreeze({
    ...state,
    contracts: {
      ...state.contracts,
      projects: {
        ...state.contracts.projects,
        [P1]: { ...project, progress: { frontend: full.length * SIZE }, fragments: full },
      },
    },
  });
}

const employee = (state: GameState, id: EmployeeId) => state.staff.employees[id] as Employee;
const fragmentsOf = (state: GameState) => state.contracts.projects[P1]?.fragments ?? [];

function run(state: GameState, steps: number): GameState {
  let current = state;
  for (let i = 0; i < steps; i++) current = doTesting(current, CONFIG);
  return current;
}

describe('kolejka QA (BUG-05, SH-004 B2)', () => {
  it('testuje od najstarszego fragmentu bez względu na specjalizację', () => {
    const { state, ids } = seated([['qa', 'senior']]);
    const start = withFragments(state, [
      { specialization: 'backend' },
      { specialization: 'frontend' },
      { specialization: 'mobile' },
    ]);
    const perStep = testPerStep(employee(start, ids[0] as EmployeeId), CONFIG);
    const after = run(start, Math.ceil(SIZE / perStep) + 1);

    const [first, second, third] = fragmentsOf(after);
    expect(first?.testProgress).toBe(SIZE);
    expect(second?.testProgress).toBeGreaterThan(0);
    expect(second?.testProgress).toBeLessThan(SIZE);
    expect(third?.testProgress).toBe(0);
  });

  it('dwóch testerów sprawdza różne fragmenty i nie traci wydajności na granicy fragmentu', () => {
    const { state, ids } = seated([
      ['qa', 'senior'],
      ['qa', 'junior'],
    ]);
    const start = withFragments(
      state,
      Array.from({ length: 10 }, () => ({})),
    );
    const [senior, junior] = ids.map((id) => testPerStep(employee(start, id), CONFIG));

    const one = fragmentsOf(doTesting(start, CONFIG));
    expect(one.map((f) => f.testProgress).slice(0, 3)).toEqual([senior, junior, 0]);

    let current = start;
    const steps = Math.floor((6 * SIZE) / ((senior ?? 0) + (junior ?? 0)));
    for (let i = 0; i < steps; i++) {
      current = doTesting(current, CONFIG);
      const partial = fragmentsOf(current).filter(
        (f) => f.testProgress > 0 && f.testProgress < SIZE,
      );
      expect(partial.length).toBeLessThanOrEqual(2);
    }
    const total = fragmentsOf(current).reduce((sum, f) => sum + f.testProgress, 0);
    expect(total).toBe(steps * ((senior ?? 0) + (junior ?? 0)));
  });

  it('seniority zmienia tempo testów: senior dwa razy szybciej niż junior (SH-032 B6)', () => {
    const { state, ids } = seated([
      ['qa', 'senior'],
      ['qa', 'junior'],
    ]);
    const [senior, junior] = ids.map((id) => testPerStep(employee(state, id), CONFIG));
    expect(senior).toBe(2 * (junior ?? 0));
  });

  it('pusta kolejka: status „brak pracy do testowania”, tester przypisany, stan bez zmian', () => {
    const { state, ids } = seated([['qa', 'mid']]);
    const id = ids[0] as EmployeeId;
    const empty = withFragments(state, []);

    expect(workStatus(empty, employee(empty, id), CONFIG)).toBe('nothingToTest');
    expect(isTesting(empty, employee(empty, id), CONFIG)).toBe(false);
    expect(doTesting(empty, CONFIG)).toBe(empty);
    expect(employee(empty, id).projectId).toBe(P1);

    const queued = withFragments(state, [{}]);
    expect(workStatus(queued, employee(queued, id), CONFIG)).toBe('ready');
    expect(isTesting(queued, employee(queued, id), CONFIG)).toBe(true);
  });

  it('nadmiarowy tester nie testuje, gdy fragmentów jest mniej niż testerów', () => {
    const { state, ids } = seated([
      ['qa', 'senior'],
      ['qa', 'junior'],
    ]);
    const one = withFragments(state, [{}]);
    const [first, second] = ids.map((id) => isTesting(one, employee(one, id), CONFIG));
    expect([first, second]).toEqual([true, false]);
  });
});

describe('wykrywanie i pokrycie (BUG-03, BUG-05, BUG-06)', () => {
  it('błąd jest wykryty dopiero po pełnym teście fragmentu', () => {
    const { state, ids } = seated([['qa', 'senior']]);
    const start = withFragments(state, [{ hasBug: true }, { hasBug: true }]);
    const project = () => start.contracts.projects[P1];
    expect(detectedBugCount(project() as never, CONFIG)).toBe(0);

    const perStep = testPerStep(employee(start, ids[0] as EmployeeId), CONFIG);
    const almost = run(start, Math.ceil(SIZE / perStep) - 1);
    expect(detectedBugCount(almost.contracts.projects[P1] as never, CONFIG)).toBe(0);
    const done = run(almost, 1);
    expect(detectedBugCount(done.contracts.projects[P1] as never, CONFIG)).toBe(1);
  });

  it('pokrycie to przetestowana część wykonanej pracy; bez pracy — brak wartości', () => {
    const { state } = seated([['qa', 'senior']]);
    const project = (s: GameState) => s.contracts.projects[P1] as never;

    expect(testCoverage(project(withFragments(state, [])), CONFIG)).toBeNull();
    expect(testCoverage(project(withFragments(state, [{}, {}])), CONFIG)).toBe(0);
    expect(
      testCoverage(project(withFragments(state, [{ testProgress: SIZE }, {}, {}, {}])), CONFIG),
    ).toBe(25);
    // Częściowy test fragmentu nie podnosi pokrycia.
    expect(
      testCoverage(project(withFragments(state, [{ testProgress: SIZE - 1 }, {}])), CONFIG),
    ).toBe(0);
  });

  it('testy w pełnym kroku silnika: QA dogania developera i ujawnia błędy', () => {
    const engine = createEngine({ config: CONFIG, initialState: testState() });
    const starter = engine.getState().contracts.offers[0];
    if (starter) engine.dispatch({ type: 'AcceptOffer', offerId: starter.id });
    for (const [specialization, seniority] of [
      ['frontend', 'junior'],
      ['qa', 'senior'],
    ] as const) {
      const candidate = engine
        .getState()
        .staff.candidates.find(
          (c) => c.specialization === specialization && c.seniority === seniority,
        );
      if (!candidate) throw new Error('brak kandydata');
      engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
      const id = Object.values(engine.getState().staff.employees).at(-1)?.id as EmployeeId;
      engine.dispatch({ type: 'AssignProject', employeeId: id, projectId: P1 });
    }
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    for (let i = 0; i < 5000; i++) engine.step();

    const project = engine.getState().contracts.projects[P1];
    if (!project) throw new Error('brak projektu');
    expect(project.fragments.length).toBeGreaterThan(2);
    // QA (160 pp/dzień) jest szybszy niż junior (60): przetestowane wszystkie fragmenty poza bieżącym.
    const untested = project.fragments.filter((f) => f.testProgress < SIZE);
    expect(untested.length).toBeLessThanOrEqual(1);
    expect(detectedBugCount(project, CONFIG)).toBe(
      project.fragments.filter((f) => f.hasBug && f.testProgress >= SIZE).length,
    );
  });
});
