import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { POINT_SCALE, type Fragment, type Project, type ProjectId } from '../domain/contracts';
import type { EmployeeId } from '../domain/employees';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testState } from '../test/engineFixture';
import { paymentPreview } from './delivery';
import { createEngine } from './engine';
import { DAY_LENGTH_MS } from './time';

const P1 = 'project-1' as ProjectId;

// Projekt startowy (frontend 60 pp, backend 40 pp, design 1) przyjęty w dniu 1 — termin dzień 4.
function accepted(): GameState {
  const engine = createEngine({ config: DEFAULT_BALANCE, initialState: testState() });
  const starter = engine.getState().contracts.offers[0];
  if (!starter) throw new Error('brak oferty');
  engine.dispatch({ type: 'AcceptOffer', offerId: starter.id });
  const frontend = engine
    .getState()
    .staff.candidates.find((c) => c.specialization === 'frontend' && c.seniority === 'junior');
  if (!frontend) throw new Error('brak kandydata');
  engine.dispatch({ type: 'HireCandidate', candidateId: frontend.id });
  engine.dispatch({ type: 'AssignProject', employeeId: 'employee-1' as EmployeeId, projectId: P1 });
  return engine.getState();
}

const project = (state: GameState) => state.contracts.projects[P1] as Project;

// Ukończona technika z `bugs` nienaprawionymi błędami; opcjonalnie inny dzień i faza misji.
function completed(
  bugs = 0,
  mission: Partial<GameState['mission']> = {},
  patch: Partial<Project> = {},
): GameState {
  const state = accepted();
  const fragments: Fragment[] = Array.from({ length: 10 }, (_, i) => ({
    specialization: i < 6 ? 'frontend' : 'backend',
    hasBug: i < bugs,
    testProgress: 0,
    repairProgress: 0,
  }));
  return deepFreeze({
    ...state,
    mission: { ...state.mission, ...mission },
    contracts: {
      ...state.contracts,
      projects: {
        ...state.contracts.projects,
        [P1]: {
          ...project(state),
          progress: { frontend: 60 * POINT_SCALE, backend: 40 * POINT_SCALE },
          fragments,
          ...patch,
        },
      },
    },
  });
}

const engineFor = (state: GameState) =>
  createEngine({ config: DEFAULT_BALANCE, initialState: state });

describe('warunki oddania (PROJ-06)', () => {
  it('nieukończona technika — odmowa bez zmiany stanu', () => {
    const engine = engineFor(accepted());
    const before = engine.getState();
    expect(engine.dispatch({ type: 'DeliverProject', projectId: P1 })).toEqual({
      ok: false,
      rejection: { code: 'projectIncomplete' },
    });
    expect(engine.getState()).toBe(before);
  });

  it('nie wymaga QA, designu, PM-a ani napraw', () => {
    const engine = engineFor(completed(4));
    expect(project(engine.getState()).designScope).toBeGreaterThan(0);
    expect(engine.dispatch({ type: 'DeliverProject', projectId: P1 })).toEqual({ ok: true });
  });

  it('po zakończeniu pracy przed rozliczeniem — tak; po rozliczeniu — nie', () => {
    expect(
      engineFor(completed(0, { phase: 'workEnded', speed: 0 })).dispatch({
        type: 'DeliverProject',
        projectId: P1,
      }),
    ).toEqual({ ok: true });
    expect(
      engineFor(completed(0, { phase: 'leaving', speed: 0, timeInDayMs: DAY_LENGTH_MS })).dispatch({
        type: 'DeliverProject',
        projectId: P1,
      }),
    ).toEqual({ ok: true });
    const settled = engineFor(
      completed(0, {
        phase: 'settled',
        speed: 0,
        report: {
          day: 1,
          income: 0,
          spending: 0,
          wages: 0,
          upkeep: 0,
          cashAfterSettlement: 0,
          rescueDeadlineDay: null,
        },
      }),
    );
    expect(settled.dispatch({ type: 'DeliverProject', projectId: P1 })).toEqual({
      ok: false,
      rejection: { code: 'phaseNotAllowed' },
    });
  });
});

describe('rozliczenie oddania (PROJ-07, FIN-01, FIN-04, BUG-04)', () => {
  it('terminowo: reszta wynagrodzenia, reputacja, zamknięcie i zdjęcie przydziałów', () => {
    const start = completed(0);
    const engine = engineFor(start);
    const { reward, advance } = project(start);
    engine.dispatch({ type: 'DeliverProject', projectId: P1 });
    const state = engine.getState();
    const delivered = project(state);

    expect(state.finance.cash).toBe(start.finance.cash + reward - advance);
    expect(state.finance.ledger.at(-1)).toMatchObject({
      key: `payment:${P1}`,
      kind: 'payment',
      amount: reward - advance,
    });
    expect(delivered.status).toBe('delivered');
    expect(state.contracts.deliveredCount).toBe(1);
    // Terminowo +4, jakość 1,0 → +4, design nieukończony → 0.
    expect(delivered.delivery).toEqual({
      day: 1,
      daysLate: 0,
      penalty: 0,
      payment: reward - advance,
      remainingBugs: 0,
      qualityPermille: 1000,
      designPermille: 0,
      reputation: { punctuality: 4, quality: 4, design: 0, total: 8 },
      reputationAfter: 58,
    });
    expect(state.mission.reputation).toBe(58);
    const employee = state.staff.employees['employee-1' as EmployeeId];
    expect(employee?.projectId).toBeNull();
    expect(employee?.deskId).toBe(start.staff.employees['employee-1' as EmployeeId]?.deskId);
  });

  it('błędy obniżają jakość i reputację, ale nie wypłatę', () => {
    const clean = engineFor(completed(0));
    const buggy = engineFor(completed(3));
    clean.dispatch({ type: 'DeliverProject', projectId: P1 });
    buggy.dispatch({ type: 'DeliverProject', projectId: P1 });
    const report = project(buggy.getState()).delivery;

    expect(report?.payment).toBe(project(clean.getState()).delivery?.payment);
    expect(report?.remainingBugs).toBe(3);
    expect(report?.qualityPermille).toBe(400);
    expect(report?.reputation.quality).toBe(-8);
  });

  it('kara za każdy rozpoczęty dzień opóźnienia, tylko z reszty i najwyżej do zera', () => {
    const late = completed(0, { day: 6 });
    const { reward, advance, latePenaltyPerDay } = project(late);
    expect(paymentPreview(project(late), 4)).toEqual({
      daysLate: 0,
      penalty: 0,
      payment: reward - advance,
    });
    expect(paymentPreview(project(late), 6)).toEqual({
      daysLate: 2,
      penalty: 2 * latePenaltyPerDay,
      payment: reward - advance - 2 * latePenaltyPerDay,
    });
    expect(paymentPreview(project(late), 40).payment).toBe(0);
    expect(paymentPreview(project(late), 40).penalty).toBe(reward - advance);

    const engine = engineFor(late);
    engine.dispatch({ type: 'DeliverProject', projectId: P1 });
    const state = engine.getState();
    expect(project(state).delivery?.reputation.punctuality).toBe(-6);
    // Zaliczka zostaje na koncie.
    expect(state.finance.ledger.some((e) => e.key === `advance:${P1}`)).toBe(true);
  });

  it('ponowne oddanie jest niemożliwe; zamknięty projekt nie przyjmuje pracowników', () => {
    const engine = engineFor(completed(0));
    engine.dispatch({ type: 'DeliverProject', projectId: P1 });
    const after = engine.getState();
    expect(engine.dispatch({ type: 'DeliverProject', projectId: P1 })).toEqual({
      ok: false,
      rejection: { code: 'projectClosed' },
    });
    expect(
      engine.dispatch({
        type: 'AssignProject',
        employeeId: 'employee-1' as EmployeeId,
        projectId: P1,
      }),
    ).toEqual({ ok: false, rejection: { code: 'projectClosed' } });
    expect(engine.getState()).toBe(after);
  });

  it('wypłata trafia do wpływów dnia w rozliczeniu', () => {
    const engine = engineFor(completed(0, { phase: 'workEnded', speed: 0 }));
    const { reward, advance } = project(engine.getState());
    engine.dispatch({ type: 'DeliverProject', projectId: P1 });
    engine.dispatch({ type: 'SettleDay' });
    expect(engine.getState().mission.report?.income).toBe(advance + (reward - advance));
  });
});
