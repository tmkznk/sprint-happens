import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { POINT_SCALE, type Fragment, type Project, type ProjectId } from '../domain/contracts';
import type { Employee, EmployeeId, Seniority, Specialization } from '../domain/employees';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testState } from '../test/engineFixture';
import { workStatus } from './assignments';
import { fragmentSize, remainingBugCount, repairSize } from './bugs';
import { createEngine } from './engine';
import { detectedBugCount } from './qa';
import { advanceStep } from './step';
import { effectiveWorkPerStep, isAtOwnDesk, planWork } from './work';

const CONFIG = { ...DEFAULT_BALANCE, energy: { ...DEFAULT_BALANCE.energy, drainPerSecond: 0 } };
const P1 = 'project-1' as ProjectId;
const SIZE = fragmentSize(CONFIG);
const REPAIR = repairSize(CONFIG);
// Zakres projektu startowego: frontend 60 pp, backend 40 pp.
const FRONTEND_DONE = 6 * SIZE;

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

const bug = (extra: Partial<Fragment> = {}): Fragment => ({
  specialization: 'frontend',
  hasBug: true,
  testProgress: SIZE,
  repairProgress: 0,
  ...extra,
});
const clean = (extra: Partial<Fragment> = {}): Fragment => bug({ hasBug: false, ...extra });

// Podmienia frontend projektu: `frontendDone` wykonanej pracy i podane fragmenty.
function withProject(
  state: GameState,
  fragments: Fragment[],
  frontendDone: number,
  progress: Project['progress'] = {},
): GameState {
  const project = state.contracts.projects[P1];
  if (!project) throw new Error('brak projektu');
  return deepFreeze({
    ...state,
    contracts: {
      ...state.contracts,
      projects: {
        ...state.contracts.projects,
        [P1]: { ...project, progress: { frontend: frontendDone, ...progress }, fragments },
      },
    },
  });
}

const project = (state: GameState) => state.contracts.projects[P1] as Project;
const employee = (state: GameState, id: EmployeeId) => state.staff.employees[id] as Employee;

function run(state: GameState, steps: number): GameState {
  let current = state;
  for (let i = 0; i < steps; i++) current = advanceStep(current, CONFIG);
  return current;
}

// Wypełnia sześć fragmentów frontendu (pełny zakres), z błędami na podanych pozycjach.
function fullFrontend(bugsAt: number[]): Fragment[] {
  return Array.from({ length: 6 }, (_, i) => (bugsAt.includes(i) ? bug() : clean()));
}

describe('kolejność: najpierw funkcje, potem naprawy (decyzja z 2026-10-22)', () => {
  it('dopóki zakres roli trwa, wykryty błąd czeka, a developer robi funkcje', () => {
    const { state, ids } = seated([['frontend', 'senior']]);
    const id = ids[0] as EmployeeId;
    const start = withProject(state, [bug(), clean()], 2 * SIZE);
    expect(planWork(start, CONFIG).get(id)).toEqual({ kind: 'feature' });

    const after = run(start, 50);
    expect(project(after).fragments[0]?.repairProgress).toBe(0);
    expect(project(after).progress.frontend).toBeGreaterThan(2 * SIZE);
  });

  it('po ukończeniu zakresu developer sam przechodzi do napraw; potem „swoja część ukończona”', () => {
    const { state, ids } = seated([['frontend', 'senior']]);
    const id = ids[0] as EmployeeId;
    const start = withProject(state, fullFrontend([2, 4]), FRONTEND_DONE);
    expect(workStatus(start, employee(start, id), CONFIG)).toBe('ready');
    expect(detectedBugCount(project(start), CONFIG)).toBe(2);

    const perStep = effectiveWorkPerStep(employee(start, id), CONFIG);
    const done = run(start, Math.ceil((2 * REPAIR) / perStep));
    expect(detectedBugCount(project(done), CONFIG)).toBe(0);
    expect(remainingBugCount(project(done), CONFIG)).toBe(0);
    expect(workStatus(done, employee(done, id), CONFIG)).toBe('scopeDone');
  });

  it('błąd innej specjalizacji nie trafia do developera', () => {
    // Backend ukończony, wykryty błąd frontendu — backendowiec nie ma czego naprawiać.
    const { state, ids } = seated([['backend', 'senior']]);
    const id = ids[0] as EmployeeId;
    const start = withProject(state, [bug()], SIZE, { backend: 40 * POINT_SCALE });
    expect(planWork(start, CONFIG).has(id)).toBe(false);
    expect(workStatus(start, employee(start, id), CONFIG)).toBe('scopeDone');
  });
});

describe('naprawy (BUG-05, BUG-06, SH-004 B3)', () => {
  it('naprawa nie tworzy błędów, nie wymaga retestu i nie cofa funkcji', () => {
    const { state, ids } = seated([['frontend', 'junior']]);
    const start = withProject(state, fullFrontend([0, 1, 2, 3, 4, 5]), FRONTEND_DONE);
    const perStep = effectiveWorkPerStep(employee(start, ids[0] as EmployeeId), CONFIG);
    const after = run(start, Math.ceil((6 * REPAIR) / perStep));

    expect(project(after).fragments).toHaveLength(6);
    expect(project(after).fragments.every((f) => f.testProgress === SIZE)).toBe(true);
    expect(project(after).progress.frontend).toBe(FRONTEND_DONE);
    expect(remainingBugCount(project(after), CONFIG)).toBe(0);
    expect(after.rng).toEqual(start.rng);
  });

  it('dwóch developerów naprawia różne błędy; suma napraw = suma wydajności', () => {
    const { state, ids } = seated([
      ['frontend', 'senior'],
      ['frontend', 'mid'],
    ]);
    const start = withProject(state, fullFrontend([0, 1, 2, 3]), FRONTEND_DONE);
    const [a, b] = ids.map((id) => effectiveWorkPerStep(employee(start, id), CONFIG));
    expect([...planWork(start, CONFIG).values()]).toEqual([
      { kind: 'repair', fragment: 0 },
      { kind: 'repair', fragment: 1 },
    ]);

    const steps = Math.floor((3 * REPAIR) / ((a ?? 0) + (b ?? 0)));
    const after = run(start, steps);
    const total = project(after).fragments.reduce((sum, f) => sum + f.repairProgress, 0);
    expect(total).toBe(steps * ((a ?? 0) + (b ?? 0)));
    expect(project(after).fragments.every((f) => f.repairProgress <= REPAIR)).toBe(true);
  });

  it('przy jednym błędzie i dwóch osobach naprawia jedna, druga czeka', () => {
    const { state, ids } = seated([
      ['frontend', 'senior'],
      ['frontend', 'mid'],
    ]);
    const start = withProject(state, fullFrontend([3]), FRONTEND_DONE);
    const plan = planWork(start, CONFIG);
    expect(plan.get(ids[0] as EmployeeId)).toEqual({ kind: 'repair', fragment: 3 });
    expect(plan.has(ids[1] as EmployeeId)).toBe(false);
  });

  it('postęp naprawy zostaje przy błędzie po zmianie wykonawcy', () => {
    const { state, ids } = seated([['frontend', 'senior']]);
    const start = withProject(state, fullFrontend([0]), FRONTEND_DONE);
    const partial = run(start, 10);
    const progress = project(partial).fragments[0]?.repairProgress ?? 0;
    expect(progress).toBeGreaterThan(0);

    const id = ids[0] as EmployeeId;
    const unassigned = deepFreeze({
      ...partial,
      staff: {
        ...partial.staff,
        employees: {
          ...partial.staff.employees,
          [id]: { ...employee(partial, id), projectId: null },
        },
      },
    });
    expect(project(run(unassigned, 10)).fragments[0]?.repairProgress).toBe(progress);
  });
});
