import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { POINT_SCALE, type ProjectId } from '../domain/contracts';
import {
  SATISFACTION_SCALE,
  type Employee,
  type EmployeeId,
  type Seniority,
  type Specialization,
} from '../domain/employees';
import type { GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testState } from '../test/engineFixture';
import { createEngine } from './engine';
import { hasBadConditions, isUnhappy, satisfactionRates } from './satisfaction';
import { advanceStep } from './step';
import { isAtOwnDesk, pmBonusPermille } from './work';

const CONFIG = { ...DEFAULT_BALANCE, energy: { ...DEFAULT_BALANCE.energy, drainPerSecond: 0 } };
const P1 = 'project-1' as ProjectId;
const RATES = satisfactionRates(CONFIG);
const STEPS_PER_MINUTE = 60_000 / CONFIG.simulation.stepMs;
const points = (value: number) => value * SATISFACTION_SCALE;

function office(roles: [Specialization, Seniority][], assign = true) {
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
    if (assign) engine.dispatch({ type: 'AssignProject', employeeId: id, projectId: P1 });
    ids.push(id);
  }
  engine.dispatch({ type: 'SetSpeed', speed: 1 });
  return { engine, ids };
}

// Czeka, aż osoby z biurkiem usiądą przy nim.
function seated(roles: [Specialization, Seniority][], assign = true) {
  const { engine, ids } = office(roles, assign);
  const ready = () =>
    ids.every((id) => {
      const employee = engine.getState().staff.employees[id] as Employee;
      return !employee.deskId || isAtOwnDesk(engine.getState(), employee);
    });
  for (let i = 0; i < 400 && !ready(); i++) engine.step();
  return { state: engine.getState(), ids };
}

const employee = (state: GameState, id: EmployeeId) => state.staff.employees[id] as Employee;

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

describe('zadowolenie (NEED-03, NEED-04, SH-032 B3)', () => {
  it('nowa osoba zaczyna od poziomu neutralnego 70', () => {
    const { state, ids } = seated([['frontend', 'mid']]);
    expect(employee(state, ids[0] as EmployeeId).satisfaction).toBe(points(70));
  });

  it('dobre warunki: powrót do neutralnego o 1 pkt na minutę gry — z dołu i z góry', () => {
    const { state, ids } = seated([['frontend', 'mid']]);
    const id = ids[0] as EmployeeId;
    const low = run(patchEmployee(state, id, { satisfaction: points(50) }), STEPS_PER_MINUTE);
    expect(employee(low, id).satisfaction).toBe(points(51));
    const high = run(patchEmployee(state, id, { satisfaction: points(80) }), 2 * STEPS_PER_MINUTE);
    expect(employee(high, id).satisfaction).toBe(points(78));
    const near = run(patchEmployee(state, id, { satisfaction: points(70) - 1 }), 10);
    expect(employee(near, id).satisfaction).toBe(points(70));
  });

  it('brak przydziału do projektu sam nie szkodzi', () => {
    const { state, ids } = seated([['backend', 'junior']], false);
    const id = ids[0] as EmployeeId;
    expect(employee(state, id).projectId).toBeNull();
    expect(hasBadConditions(state, employee(state, id), CONFIG)).toBe(false);
    expect(employee(run(state, 3 * STEPS_PER_MINUTE), id).satisfaction).toBe(points(70));
  });

  it('brak biurka: okres tolerancji 60 s, potem spadek 2 pkt na minutę', () => {
    const { state, ids } = seated([
      ['frontend', 'mid'],
      ['backend', 'mid'],
      ['qa', 'mid'],
    ]);
    const deskless = ids[2] as EmployeeId;
    expect(employee(state, deskless).deskId).toBeNull();
    const start = patchEmployee(state, deskless, { badConditionsMs: 0 });

    const tolerated = run(start, STEPS_PER_MINUTE);
    expect(employee(tolerated, deskless).satisfaction).toBe(points(70));
    const declined = run(tolerated, STEPS_PER_MINUTE);
    expect(employee(declined, deskless).satisfaction).toBe(points(68));
    // Osoby z biurkami bez zmian.
    expect(employee(declined, ids[0] as EmployeeId).satisfaction).toBe(points(70));
  });

  it('praca przy bardzo niskiej energii to złe warunki; poprawa kasuje okres tolerancji', () => {
    const { state, ids } = seated([['frontend', 'mid']]);
    const id = ids[0] as EmployeeId;
    const tired = patchEmployee(state, id, { energy: 10_000 });
    expect(hasBadConditions(tired, employee(tired, id), CONFIG)).toBe(true);

    const after = run(tired, 10);
    expect(employee(after, id).badConditionsMs).toBe(10 * CONFIG.simulation.stepMs);
    const rested = run(patchEmployee(after, id, { energy: 80_000 }), 1);
    expect(employee(rested, id).badConditionsMs).toBe(0);
  });

  it('stawki są konfigurowalne', () => {
    expect(RATES.toleranceMs).toBe(60_000);
    expect(RATES.warningLevel).toBe(points(25));
    expect(RATES.quitAfterMs).toBe(600_000);
  });
});

describe('ostrzeżenie i odejście (NEED-05, EMP-08)', () => {
  it('poniżej 25 — ostrzeżenie; po pełnym dniu poniżej progu osoba odchodzi', () => {
    const { state, ids } = seated([
      ['frontend', 'senior'],
      ['backend', 'mid'],
      ['qa', 'junior'],
    ]);
    const id = ids[2] as EmployeeId;
    expect(employee(state, id).deskId).toBeNull();
    const withProgress = deepFreeze({
      ...state,
      // Pełny dzień przed nami — odliczanie do odejścia to 600 s czasu gry.
      mission: { ...state.mission, timeInDayMs: 0 },
      contracts: {
        ...state.contracts,
        projects: {
          ...state.contracts.projects,
          [P1]: {
            ...state.contracts.projects[P1],
            progress: { frontend: 5 * POINT_SCALE },
          } as never,
        },
      },
    });
    // Brak biurka przez cały czas: zadowolenie tuż przy progu i spadające.
    const unhappy = patchEmployee(withProgress, id, {
      satisfaction: points(25) - 1,
      badConditionsMs: RATES.toleranceMs + 1,
    });
    expect(isUnhappy(employee(unhappy, id), CONFIG)).toBe(true);

    const almost = run(unhappy, RATES.quitAfterMs / CONFIG.simulation.stepMs - 1);
    expect(almost.staff.employees[id]).toBeDefined();
    const gone = run(almost, 1);
    expect(gone.staff.employees[id]).toBeUndefined();
    expect(gone.staff.departures).toEqual([
      { employeeId: id, name: employee(state, id).name, day: 1, reason: 'quit' },
    ]);
    expect(gone.world.movement.agents.some((a) => a.id === id)).toBe(false);
    expect(gone.finance.wagesDueToday[id]).toBe(employee(state, id).dailyWage);
    expect(gone.contracts.projects[P1]?.progress.frontend).toBeGreaterThanOrEqual(5 * POINT_SCALE);
  });

  it('powrót powyżej progu kasuje odliczanie do odejścia', () => {
    const { state, ids } = seated([['frontend', 'mid']]);
    const id = ids[0] as EmployeeId;
    const counting = patchEmployee(state, id, {
      satisfaction: points(25) - 1,
      lowSatisfactionMs: RATES.quitAfterMs - 1000,
    });
    // Dobre warunki: zadowolenie rośnie i po chwili przekracza próg.
    const better = run(counting, 1);
    expect(employee(better, id).satisfaction).toBeGreaterThanOrEqual(points(25));
    expect(employee(better, id).lowSatisfactionMs).toBe(0);
    expect(run(better, 100).staff.employees[id]).toBeDefined();
  });

  it('odejście jest deterministyczne — ten sam przebieg, ten sam moment', () => {
    const play = () => {
      const { state, ids } = seated([
        ['frontend', 'mid'],
        ['backend', 'mid'],
        ['qa', 'junior'],
      ]);
      const deskless = ids[2] as EmployeeId;
      let current = patchEmployee(state, deskless, { satisfaction: points(26) });
      let steps = 0;
      while (current.staff.employees[deskless] && steps < 20_000) {
        current = advanceStep(current, CONFIG);
        if (current.mission.phase !== 'working') {
          current = deepFreeze({
            ...current,
            mission: { ...current.mission, phase: 'working', speed: 1, timeInDayMs: 0 },
          });
        }
        steps++;
      }
      return steps;
    };
    const first = play();
    expect(first).toBeLessThan(20_000);
    expect(play()).toBe(first);
  });
});

describe('zwolnienie (EMP-08, FIN-03)', () => {
  it('zwalnia biurko i przydział, zachowuje dniówkę za dziś; PM-owi znika premia', () => {
    const { engine, ids } = office([
      ['frontend', 'mid'],
      ['pm', 'senior'],
    ]);
    const [dev, pm] = ids as [EmployeeId, EmployeeId];
    expect(pmBonusPermille(engine.getState(), P1, CONFIG)).toBe(200);
    const desk = engine.getState().staff.employees[pm]?.deskId;

    expect(engine.dispatch({ type: 'FireEmployee', employeeId: pm })).toEqual({ ok: true });
    const state = engine.getState();
    expect(state.staff.employees[pm]).toBeUndefined();
    expect(pmBonusPermille(state, P1, CONFIG)).toBe(0);
    expect(state.finance.wagesDueToday[pm]).toBeGreaterThan(0);
    expect(state.staff.departures.at(-1)).toMatchObject({ employeeId: pm, reason: 'fired' });
    // Biurko wolne dla kolejnej osoby; reszta zespołu bez zmian.
    expect(Object.values(state.staff.employees).some((e) => e.deskId === desk)).toBe(false);
    expect(state.staff.employees[dev]?.satisfaction).toBe(points(70));
  });

  it('pensja zwolnionego tylko za dzień zwolnienia; nieznany pracownik — odmowa', () => {
    const { engine, ids } = office([['frontend', 'mid']]);
    const id = ids[0] as EmployeeId;
    const before = engine.getState();
    expect(
      engine.dispatch({ type: 'FireEmployee', employeeId: 'employee-99' as EmployeeId }),
    ).toEqual({
      ok: false,
      rejection: { code: 'unknownEmployee' },
    });
    expect(engine.getState()).toBe(before);

    engine.dispatch({ type: 'FireEmployee', employeeId: id });
    engine.dispatch({ type: 'SetSpeed', speed: 0 });
    for (let i = 0; i < 6001; i++) {
      if (engine.getState().mission.phase !== 'working') break;
      engine.dispatch({ type: 'SetSpeed', speed: 4 });
      engine.step();
    }
    engine.dispatch({ type: 'SettleDay' });
    expect(engine.getState().finance.ledger.filter((e) => e.ref === id)).toHaveLength(1);
    engine.dispatch({ type: 'StartNextDay' });
    expect(engine.getState().finance.wagesDueToday[id]).toBeUndefined();
  });
});
