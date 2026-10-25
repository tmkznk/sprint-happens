import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { POINT_SCALE, type Project, type ProjectId } from '../domain/contracts';
import type { Employee, EmployeeId, Specialization } from '../domain/employees';
import type { GameState } from '../domain/state';
import { testState } from '../test/engineFixture';
import { missingRoles, workStatus } from './assignments';
import { createEngine } from './engine';

type Engine = ReturnType<typeof createEngine>;

function setup() {
  const engine = createEngine({ config: DEFAULT_BALANCE, initialState: testState() });
  // Projekt 1: kontrakt startowy (Frontend 60, Backend 40, design 1); projekt 2: kolejna oferta.
  for (const offer of engine.getState().contracts.offers.slice(0, 2)) {
    engine.dispatch({ type: 'AcceptOffer', offerId: offer.id });
  }
  return engine;
}

function hire(engine: Engine, specialization: Specialization): EmployeeId {
  const candidate = engine
    .getState()
    .staff.candidates.find((c) => c.specialization === specialization && c.seniority === 'mid');
  if (!candidate) throw new Error('brak kandydata');
  engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
  const hired = Object.values(engine.getState().staff.employees).at(-1);
  if (!hired) throw new Error('brak pracownika');
  return hired.id;
}

const P1 = 'project-1' as ProjectId;
const P2 = 'project-2' as ProjectId;
const employee = (state: GameState, id: EmployeeId) => state.staff.employees[id] as Employee;

describe('AssignProject (EMP-05, EMP-06, PROJ-11)', () => {
  it('jedna osoba ma jeden przydział; zmiana i odpięcie działają, biurko bez zmian', () => {
    const engine = setup();
    const id = hire(engine, 'frontend');
    const desk = employee(engine.getState(), id).deskId;

    expect(engine.dispatch({ type: 'AssignProject', employeeId: id, projectId: P1 })).toEqual({
      ok: true,
    });
    engine.dispatch({ type: 'AssignProject', employeeId: id, projectId: P2 });
    expect(employee(engine.getState(), id)).toMatchObject({ projectId: P2, deskId: desk });

    engine.dispatch({ type: 'AssignProject', employeeId: id, projectId: null });
    expect(employee(engine.getState(), id).projectId).toBeNull();
  });

  it('kilku specjalistów tej samej roli może pracować w jednym projekcie', () => {
    const engine = setup();
    const a = hire(engine, 'frontend');
    const b = hire(engine, 'frontend');

    expect(engine.dispatch({ type: 'AssignProject', employeeId: a, projectId: P1 }).ok).toBe(true);
    expect(engine.dispatch({ type: 'AssignProject', employeeId: b, projectId: P1 }).ok).toBe(true);
  });

  it('drugi PM w projekcie jest odrzucany; w innym projekcie dozwolony', () => {
    const engine = setup();
    const pm1 = hire(engine, 'pm');
    const pm2 = hire(engine, 'pm');
    engine.dispatch({ type: 'AssignProject', employeeId: pm1, projectId: P1 });
    const before = engine.getState();

    expect(engine.dispatch({ type: 'AssignProject', employeeId: pm2, projectId: P1 })).toEqual({
      ok: false,
      rejection: { code: 'pmAlreadyAssigned' },
    });
    expect(engine.getState()).toBe(before);
    expect(engine.dispatch({ type: 'AssignProject', employeeId: pm2, projectId: P2 }).ok).toBe(
      true,
    );
  });

  it('odrzuca oddany projekt (PROJ-07), nieznany projekt i pracę po końcu dnia', () => {
    const engine = setup();
    const id = hire(engine, 'backend');
    const state = engine.getState();
    const project = state.contracts.projects[P1];
    if (!project) throw new Error('brak projektu');
    const closed = createEngine({
      config: DEFAULT_BALANCE,
      initialState: {
        ...state,
        contracts: {
          ...state.contracts,
          projects: { ...state.contracts.projects, [P1]: { ...project, status: 'delivered' } },
          deliveredCount: 1,
        },
      },
    });

    expect(closed.dispatch({ type: 'AssignProject', employeeId: id, projectId: P1 })).toEqual({
      ok: false,
      rejection: { code: 'projectClosed' },
    });
    expect(
      closed.dispatch({
        type: 'AssignProject',
        employeeId: id,
        projectId: 'project-9' as ProjectId,
      }),
    ).toEqual({ ok: false, rejection: { code: 'unknownProject' } });

    const ended = createEngine({
      config: DEFAULT_BALANCE,
      initialState: {
        ...state,
        mission: { ...state.mission, phase: 'workEnded', timeInDayMs: 600_000 },
      },
    });
    expect(ended.dispatch({ type: 'AssignProject', employeeId: id, projectId: P2 })).toEqual({
      ok: false,
      rejection: { code: 'phaseNotAllowed' },
    });
  });
});

describe('workStatus (EMP-07, EMP-04)', () => {
  it('rozróżnia brak przydziału, brak biurka, brak pracy dla roli i gotowość', () => {
    const engine = setup();
    const frontend = hire(engine, 'frontend');
    const mobile = hire(engine, 'mobile');
    const deskless = hire(engine, 'backend');
    const qa = hire(engine, 'qa');
    for (const id of [frontend, mobile, deskless, qa]) {
      engine.dispatch({ type: 'AssignProject', employeeId: id, projectId: P1 });
    }
    const state = engine.getState();
    expect(employee(state, deskless).deskId).toBeNull();

    expect(workStatus(state, employee(state, frontend), DEFAULT_BALANCE)).toBe('ready');
    expect(workStatus(state, employee(state, mobile), DEFAULT_BALANCE)).toBe('noWorkForRole');
    expect(workStatus(state, employee(state, deskless), DEFAULT_BALANCE)).toBe('noDesk');
    expect(workStatus(state, employee(state, qa), DEFAULT_BALANCE)).toBe('noDesk');

    engine.dispatch({ type: 'AssignProject', employeeId: frontend, projectId: null });
    expect(
      workStatus(engine.getState(), employee(engine.getState(), frontend), DEFAULT_BALANCE),
    ).toBe('noAssignment');
  });
});

describe('missingRoles (PROJ-02, PROJ-03)', () => {
  const project = {
    scopes: { frontend: 60, backend: 40 },
    progress: { frontend: 0, backend: 40 * POINT_SCALE },
  } as unknown as Project;

  it('zakres z pracą do zrobienia i bez osoby tej specjalizacji', () => {
    expect(missingRoles(project, [])).toEqual(['frontend']);
    expect(missingRoles({ ...project, progress: {} } as Project, [])).toEqual([
      'frontend',
      'backend',
    ]);
  });

  it('obsadzony zakres, ukończony zakres i role opcjonalne nie są brakujące', () => {
    expect(missingRoles(project, [{ specialization: 'frontend' }])).toEqual([]);
    expect(
      missingRoles({ ...project, progress: {} } as Project, [
        { specialization: 'qa' },
        { specialization: 'pm' },
        { specialization: 'designer' },
      ]),
    ).toEqual(['frontend', 'backend']);
  });
});
