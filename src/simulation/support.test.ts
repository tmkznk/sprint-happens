import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { POINT_SCALE, type Fragment, type Project, type ProjectId } from '../domain/contracts';
import type { Employee, EmployeeId, Seniority, Specialization } from '../domain/employees';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testState } from '../test/engineFixture';
import { workStatus } from './assignments';
import { fragmentSize } from './bugs';
import { createEngine } from './engine';
import { doTesting, testPerStep } from './qa';
import { advanceStep } from './step';
import {
  applyBonus,
  effectiveWorkPerStep,
  isAtOwnDesk,
  planWork,
  pmBonusPermille,
  workPerStep,
} from './work';

const CONFIG = { ...DEFAULT_BALANCE, energy: { ...DEFAULT_BALANCE.energy, drainPerSecond: 0 } };
const P1 = 'project-1' as ProjectId;
const SIZE = fragmentSize(CONFIG);

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

const project = (state: GameState) => state.contracts.projects[P1] as Project;
const employee = (state: GameState, id: EmployeeId) => state.staff.employees[id] as Employee;

function patchProject(state: GameState, patch: Partial<Project>): GameState {
  return deepFreeze({
    ...state,
    contracts: {
      ...state.contracts,
      projects: { ...state.contracts.projects, [P1]: { ...project(state), ...patch } },
    },
  });
}

function patchEmployee(state: GameState, id: EmployeeId, patch: Partial<Employee>): GameState {
  return deepFreeze({
    ...state,
    staff: {
      ...state.staff,
      employees: { ...state.staff.employees, [id]: { ...employee(state, id), ...patch } },
    },
  });
}

function run(state: GameState, steps: number): GameState {
  let current = state;
  for (let i = 0; i < steps; i++) current = advanceStep(current, CONFIG);
  return current;
}

// Zakres projektu startowego: frontend 60 pp, backend 40 pp; design 1 × 20 pp.
const TECH_DONE = { frontend: 60 * POINT_SCALE, backend: 40 * POINT_SCALE };
const doneFragments = (): Fragment[] =>
  Array.from({ length: 10 }, (_, i) => ({
    specialization: i < 6 ? 'frontend' : 'backend',
    hasBug: false,
    testProgress: 0,
    repairProgress: 0,
  }));

describe('Designer (PROJ-10)', () => {
  it('pracuje równolegle i po ukończeniu techniki; nie tworzy fragmentów; pułap = zakres', () => {
    const { state, ids } = seated([['designer', 'senior']]);
    const id = ids[0] as EmployeeId;
    const scope = project(state).designScope * POINT_SCALE;
    expect(scope).toBe(20 * POINT_SCALE);

    const techDone = patchProject(state, { progress: TECH_DONE, fragments: doneFragments() });
    expect(planWork(techDone, CONFIG).get(id)).toEqual({ kind: 'design' });
    const perStep = effectiveWorkPerStep(employee(techDone, id), CONFIG);
    const after = run(techDone, 10);
    expect(project(after).designProgress - project(techDone).designProgress).toBe(10 * perStep);
    expect(project(after).fragments).toHaveLength(10);

    const finished = run(after, Math.ceil(scope / perStep));
    expect(project(finished).designProgress).toBe(scope);
    expect(workStatus(finished, employee(finished, id), CONFIG)).toBe('scopeDone');
    expect(planWork(finished, CONFIG).has(id)).toBe(false);
  });

  it('seniority zmienia tempo, nie osiągalny pułap', () => {
    const { state, ids } = seated([
      ['designer', 'senior'],
      ['designer', 'junior'],
    ]);
    const [senior, junior] = ids.map((id) => workPerStep(employee(state, id), CONFIG));
    expect(senior).toBe(2 * (junior ?? 0));
    const scope = project(state).designScope * POINT_SCALE;
    expect(project(run(state, 3000)).designProgress).toBe(scope);
  });

  it('projekt bez designu nie ma pracy dla Designera', () => {
    const { state, ids } = seated([['designer', 'mid']]);
    const id = ids[0] as EmployeeId;
    const noDesign = patchProject(state, { designScope: 0, designImportance: 0 });
    expect(workStatus(noDesign, employee(noDesign, id), CONFIG)).toBe('noWorkForRole');
    expect(planWork(noDesign, CONFIG).has(id)).toBe(false);
  });
});

describe('premia PM-a (PROJ-11)', () => {
  it('senior PM z biurkiem przyspiesza developera o 20%; nie zmienia ryzyka błędów', () => {
    const { state, ids } = seated([
      ['frontend', 'senior'],
      ['pm', 'senior'],
    ]);
    const [dev] = ids as [EmployeeId, EmployeeId];
    expect(pmBonusPermille(state, P1, CONFIG)).toBe(200);
    const before = project(state).progress.frontend ?? 0;
    const after = run(state, 10);
    const base = effectiveWorkPerStep(employee(state, dev), CONFIG);
    expect((project(after).progress.frontend ?? 0) - before).toBe(10 * applyBonus(base, 200));
    expect(applyBonus(base, 200)).toBe(Math.floor(base * 1.2));
  });

  it('działa na przerwie i przy zerowej energii; brak biurka lub przydziału ją usuwa', () => {
    const { state, ids } = seated([['pm', 'mid']]);
    const pm = ids[0] as EmployeeId;
    expect(pmBonusPermille(state, P1, CONFIG)).toBe(150);
    expect(pmBonusPermille(patchEmployee(state, pm, { energy: 0 }), P1, CONFIG)).toBe(150);
    expect(pmBonusPermille(patchEmployee(state, pm, { deskId: null }), P1, CONFIG)).toBe(0);
    expect(pmBonusPermille(patchEmployee(state, pm, { projectId: null }), P1, CONFIG)).toBe(0);
  });

  it('drugi PM nie kumuluje premii — liczy się najwyższa', () => {
    const { state, ids } = seated([
      ['pm', 'junior'],
      ['pm', 'senior'],
    ]);
    // Polecenie odrzuca drugiego PM-a (pmAlreadyAssigned) — wymuszamy przydział w stanie.
    const both = patchEmployee(state, ids[1] as EmployeeId, { projectId: P1 });
    expect(pmBonusPermille(both, P1, CONFIG)).toBe(200);
  });

  it('obejmuje QA', () => {
    const { state, ids } = seated([
      ['qa', 'senior'],
      ['pm', 'junior'],
    ]);
    const start = patchProject(state, { progress: TECH_DONE, fragments: doneFragments() });
    const qaRate = testPerStep(employee(start, ids[0] as EmployeeId), CONFIG);
    expect(project(doTesting(start, CONFIG)).fragments[0]?.testProgress).toBe(
      applyBonus(qaRate, 100),
    );
  });

  it('obejmuje naprawy', () => {
    const { state, ids } = seated([
      ['frontend', 'senior'],
      ['pm', 'junior'],
    ]);
    const fragments = doneFragments();
    fragments[0] = { ...fragments[0], hasBug: true, testProgress: SIZE } as Fragment;
    const start = patchProject(state, { progress: TECH_DONE, fragments });
    const devRate = effectiveWorkPerStep(employee(start, ids[0] as EmployeeId), CONFIG);
    expect(project(run(start, 1)).fragments[0]?.repairProgress).toBe(applyBonus(devRate, 100));
  });

  it('obejmuje design', () => {
    const { state, ids } = seated([
      ['designer', 'mid'],
      ['pm', 'senior'],
    ]);
    const designer = ids[0] as EmployeeId;
    const designRate = effectiveWorkPerStep(employee(state, designer), CONFIG);
    const after = run(state, 1);
    expect(project(after).designProgress - project(state).designProgress).toBe(
      applyBonus(designRate, 200),
    );
  });
});
