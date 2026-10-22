import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { POINT_SCALE, type Project, type ProjectId } from '../domain/contracts';
import {
  MAX_ENERGY,
  type Employee,
  type EmployeeId,
  type Seniority,
  type Specialization,
} from '../domain/employees';
import { seedRng } from '../domain/random';
import { testState } from '../test/engineFixture';
import { addWork, fragmentSize, hiddenBugCount, riskPermille } from './bugs';
import { createEngine } from './engine';
import { isAtOwnDesk } from './work';

type Engine = ReturnType<typeof createEngine>;
const P1 = 'project-1' as ProjectId;
const FRAGMENT = fragmentSize(DEFAULT_BALANCE);

function emptyProject(scope: number): Project {
  return {
    id: P1,
    templateId: 't',
    name: 'Test',
    description: '',
    scopes: { frontend: scope },
    designImportance: 0,
    designScope: 0,
    deadlineDays: 3,
    reward: 1000,
    advance: 300,
    latePenaltyPerDay: 100,
    acceptedOnDay: 1,
    deadlineDay: 4,
    status: 'active',
    progress: { frontend: 0 },
    fragments: [],
    fragmentRisk: {},
  };
}

const person = (seniority: Seniority, energy = MAX_ENERGY) => ({ seniority, energy }) as Employee;

// Statystyka: wiele fragmentów pracy jednej osoby, od razu po całym fragmencie.
function bugRate(seniority: Seniority, energy = MAX_ENERGY, fragments = 2000, seed = 7) {
  let project = emptyProject(fragments * DEFAULT_BALANCE.bugs.fragmentPoints);
  let rng = seedRng(seed);
  const risk = riskPermille(person(seniority, energy), DEFAULT_BALANCE);
  for (let i = 0; i < fragments; i++) {
    const result = addWork(project, 'frontend', FRAGMENT, risk, rng, DEFAULT_BALANCE);
    project = result.project as Project;
    rng = result.rng;
  }
  return hiddenBugCount(project) / fragments;
}

describe('ryzyko błędu (BUG-01, SH-032 B1/B2)', () => {
  it('senior myli się rzadziej niż junior; częstość odpowiada konfiguracji', () => {
    const junior = bugRate('junior');
    const senior = bugRate('senior');

    expect(junior).toBeGreaterThan(0.25);
    expect(junior).toBeLessThan(0.35);
    expect(senior).toBeGreaterThan(0.05);
    expect(senior).toBeLessThan(0.11);
  });

  it('niższa energia zwiększa ryzyko: × (1 + (1 − energia))', () => {
    expect(riskPermille(person('mid'), DEFAULT_BALANCE)).toBe(180);
    expect(riskPermille(person('mid', MAX_ENERGY / 2), DEFAULT_BALANCE)).toBe(270);
    expect(bugRate('mid', MAX_ENERGY / 2)).toBeGreaterThan(bugRate('mid'));
  });

  it('losowanie jest deterministyczne dla ziarna', () => {
    expect(bugRate('junior', MAX_ENERGY, 200, 3)).toBe(bugRate('junior', MAX_ENERGY, 200, 3));
  });
});

describe('fragmenty pracy (SH-004 B1)', () => {
  it('fragment rozstrzyga się dopiero po ukończeniu 10 pp; część kroku przechodzi do następnego', () => {
    let project = emptyProject(40);
    const step = Math.floor(FRAGMENT * 0.7);
    let rng = seedRng(1);
    const counts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = addWork(project, 'frontend', step, 300, rng, DEFAULT_BALANCE);
      project = result.project as Project;
      rng = result.rng;
      counts.push(project.fragments.length);
    }

    expect(counts).toEqual([0, 1, 2, 2, 3]);
    expect(project.progress.frontend).toBe(5 * step);
  });

  it('ryzyko fragmentu jest ważone udziałem wykonawców', () => {
    const half = FRAGMENT / 2;
    // Połowa fragmentu z ryzykiem 0, połowa z ryzykiem 1000 promili → 50%.
    let bugs = 0;
    for (let seed = 0; seed < 400; seed++) {
      const first = addWork(emptyProject(10), 'frontend', half, 0, seedRng(seed), DEFAULT_BALANCE);
      const second = addWork(first.project, 'frontend', half, 1000, first.rng, DEFAULT_BALANCE);
      bugs += hiddenBugCount(second.project);
    }
    expect(bugs / 400).toBeGreaterThan(0.4);
    expect(bugs / 400).toBeLessThan(0.6);
  });
});

describe('błędy w silniku (BUG-01, BUG-03)', () => {
  function office(roles: [Specialization, Seniority][]): { engine: Engine; ids: EmployeeId[] } {
    const config = { ...DEFAULT_BALANCE, energy: { ...DEFAULT_BALANCE.energy, drainPerSecond: 0 } };
    const engine = createEngine({ config, initialState: testState() });
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
    return { engine, ids };
  }

  it('liczba fragmentów odpowiada wykonanej pracy, w kolejności ukończenia', () => {
    const { engine } = office([
      ['frontend', 'senior'],
      ['backend', 'senior'],
    ]);
    for (let i = 0; i < 2500; i++) engine.step();
    const project = engine.getState().contracts.projects[P1];
    if (!project) throw new Error('brak projektu');

    const frontend = Math.floor((project.progress.frontend ?? 0) / FRAGMENT);
    const backend = Math.floor((project.progress.backend ?? 0) / FRAGMENT);
    expect(project.fragments.filter((f) => f.specialization === 'frontend')).toHaveLength(frontend);
    expect(project.fragments.filter((f) => f.specialization === 'backend')).toHaveLength(backend);
    expect(frontend + backend).toBeGreaterThan(3);
  });

  it('QA, Designer i PM nie tworzą fragmentów ani błędów', () => {
    const { engine, ids } = office([
      ['qa', 'senior'],
      ['pm', 'senior'],
    ]);
    for (
      let i = 0;
      i < 400 &&
      !ids.every((id) =>
        isAtOwnDesk(engine.getState(), engine.getState().staff.employees[id] as Employee),
      );
      i++
    ) {
      engine.step();
    }
    for (let i = 0; i < 1000; i++) engine.step();

    expect(engine.getState().contracts.projects[P1]?.fragments).toEqual([]);
  });

  it('ten sam przebieg daje te same błędy niezależnie od powtórzenia (wspólny generator)', () => {
    const run = () => {
      const { engine } = office([['frontend', 'junior']]);
      for (let i = 0; i < 3000; i++) engine.step();
      return engine.getState().contracts.projects[P1]?.fragments;
    };
    expect(run()).toEqual(run());
  });
});

describe('POINT_SCALE', () => {
  it('fragment to 10 pp w milionowych częściach', () => {
    expect(FRAGMENT).toBe(10 * POINT_SCALE);
  });
});
