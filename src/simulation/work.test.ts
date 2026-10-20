import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { MILLI_POINTS, type ProjectId } from '../domain/contracts';
import type { Employee, EmployeeId, Seniority, Specialization } from '../domain/employees';
import { testState } from '../test/engineFixture';
import { workStatus } from './assignments';
import { createEngine } from './engine';
import { isAtOwnDesk, progressPercent, workPerStep } from './work';

type Engine = ReturnType<typeof createEngine>;
const P1 = 'project-1' as ProjectId;

// Projekt 1 to kontrakt startowy: Frontend 60 pp, Backend 40 pp.
function setup() {
  const engine = createEngine({ config: DEFAULT_BALANCE, initialState: testState() });
  const starter = engine.getState().contracts.offers[0];
  if (!starter) throw new Error('brak oferty');
  engine.dispatch({ type: 'AcceptOffer', offerId: starter.id });
  return engine;
}

function hire(engine: Engine, specialization: Specialization, seniority: Seniority, assign = true) {
  const candidate = engine
    .getState()
    .staff.candidates.find((c) => c.specialization === specialization && c.seniority === seniority);
  if (!candidate) throw new Error('brak kandydata');
  engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
  const id = Object.values(engine.getState().staff.employees).at(-1)?.id as EmployeeId;
  if (assign) engine.dispatch({ type: 'AssignProject', employeeId: id, projectId: P1 });
  return id;
}

const employeeOf = (engine: Engine, id: EmployeeId) =>
  engine.getState().staff.employees[id] as Employee;
const progress = (engine: Engine, spec: 'frontend' | 'backend') =>
  engine.getState().contracts.projects[P1]?.progress[spec] ?? 0;

function runUntilAtDesk(engine: Engine, ids: EmployeeId[]) {
  engine.dispatch({ type: 'SetSpeed', speed: 1 });
  for (let i = 0; i < 400; i++) {
    if (ids.every((id) => isAtOwnDesk(engine.getState(), employeeOf(engine, id)))) return;
    engine.step();
  }
  throw new Error('pracownicy nie dotarli do biurek');
}

function steps(engine: Engine, count: number) {
  for (let i = 0; i < count; i++) engine.step();
}

describe('postęp prac (PROJ-02, PROJ-09, EMP-06)', () => {
  it('droga do biurka nie daje punktów; przy biurku rośnie wyłącznie zakres własnej roli', () => {
    const engine = setup();
    const frontend = hire(engine, 'frontend', 'junior');
    runUntilAtDesk(engine, [frontend]);
    const rate = workPerStep(employeeOf(engine, frontend), DEFAULT_BALANCE);
    // Kolejność kroku (SH-004 B4): ruch, potem praca — punkty tylko za krok, w którym osoba siedzi.
    expect(progress(engine, 'frontend')).toBe(rate);

    steps(engine, 100);

    expect(progress(engine, 'frontend')).toBe(101 * rate);
    expect(progress(engine, 'backend')).toBe(0);
  });

  it('wydajność kilku osób tej samej roli sumuje się, z uwzględnieniem seniority', () => {
    const engine = setup();
    const junior = hire(engine, 'frontend', 'junior');
    const mid = hire(engine, 'frontend', 'mid');
    runUntilAtDesk(engine, [junior, mid]);
    const before = progress(engine, 'frontend');

    steps(engine, 50);

    const perStep =
      workPerStep(employeeOf(engine, junior), DEFAULT_BALANCE) +
      workPerStep(employeeOf(engine, mid), DEFAULT_BALANCE);
    expect(progress(engine, 'frontend') - before).toBe(50 * perStep);
    expect(workPerStep(employeeOf(engine, mid), DEFAULT_BALANCE)).toBeGreaterThan(
      workPerStep(employeeOf(engine, junior), DEFAULT_BALANCE),
    );
  });

  it('osoba bez biurka nie pracuje (EMP-04)', () => {
    const engine = setup();
    hire(engine, 'mobile', 'junior', false);
    hire(engine, 'devops', 'junior', false);
    const deskless = hire(engine, 'backend', 'senior');
    expect(workStatus(engine.getState(), employeeOf(engine, deskless))).toBe('noDesk');
    engine.dispatch({ type: 'SetSpeed', speed: 1 });

    steps(engine, 300);

    expect(progress(engine, 'backend')).toBe(0);
  });

  it('nie przekracza zakresu; po ukończeniu osoba ma status „swoja część ukończona”', () => {
    const engine = setup();
    const senior = hire(engine, 'frontend', 'senior');
    runUntilAtDesk(engine, [senior]);

    steps(engine, 3500);

    const project = engine.getState().contracts.projects[P1];
    expect(progress(engine, 'frontend')).toBe(60 * MILLI_POINTS);
    expect(project && progressPercent(project, 'frontend')).toBe(100);
    expect(workStatus(engine.getState(), employeeOf(engine, senior))).toBe('scopeDone');
  });

  it('zmiana przydziału zachowuje postęp; bez przydziału nie ma pracy (EMP-05)', () => {
    const engine = setup();
    const frontend = hire(engine, 'frontend', 'junior');
    runUntilAtDesk(engine, [frontend]);
    steps(engine, 100);
    const done = progress(engine, 'frontend');

    engine.dispatch({ type: 'AssignProject', employeeId: frontend, projectId: null });
    steps(engine, 100);
    expect(progress(engine, 'frontend')).toBe(done);

    engine.dispatch({ type: 'AssignProject', employeeId: frontend, projectId: P1 });
    steps(engine, 10);
    expect(progress(engine, 'frontend')).toBeGreaterThan(done);
  });

  it('pauza zatrzymuje pracę', () => {
    const engine = setup();
    const frontend = hire(engine, 'frontend', 'junior');
    runUntilAtDesk(engine, [frontend]);
    engine.dispatch({ type: 'SetSpeed', speed: 0 });
    const before = progress(engine, 'frontend');

    steps(engine, 100);

    expect(progress(engine, 'frontend')).toBe(before);
  });

  it('rola spoza zakresu projektu nie pracuje (PROJ-01)', () => {
    const engine = setup();
    const mobile = hire(engine, 'mobile', 'senior');
    runUntilAtDesk(engine, [mobile]);
    steps(engine, 200);

    expect(workStatus(engine.getState(), employeeOf(engine, mobile))).toBe('noWorkForRole');
    expect(engine.getState().contracts.projects[P1]?.progress).toEqual({ frontend: 0, backend: 0 });
  });
});
