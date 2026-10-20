import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { SENIORITIES, SPECIALIZATIONS, type CandidateId } from '../domain/employees';
import { createInitialState, type GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testReport, testState } from '../test/engineFixture';
import { interactionCells } from '../world/geometry';
import { cellKey } from '../world/movement/grid';
import { movementEnvFor } from '../world/movement/officeEnv';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import { createEngine } from './engine';
import { forecastCash, recordOperation } from './finance';
import { freeDeskCount } from './staff';

const WAGES = DEFAULT_BALANCE.staff.dailyWage;

function engineFor(state: GameState = testState()) {
  return createEngine({ config: DEFAULT_BALANCE, initialState: state });
}

function hireFirst(engine: ReturnType<typeof engineFor>, index = 0) {
  const candidate = engine.getState().staff.candidates[index];
  if (!candidate) throw new Error('brak kandydata');
  return {
    candidate,
    result: engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id }),
  };
}

describe('rynek kandydatów (EMP-03)', () => {
  it('oferuje każdą specjalizację w każdym seniority, z pensją zależną od seniority', () => {
    const { candidates } = createInitialState(DEFAULT_BALANCE, 1).staff;

    expect(candidates).toHaveLength(SPECIALIZATIONS.length * SENIORITIES.length);
    for (const specialization of SPECIALIZATIONS) {
      for (const seniority of SENIORITIES) {
        const match = candidates.find(
          (c) => c.specialization === specialization && c.seniority === seniority,
        );
        expect(match?.dailyWage).toBe(WAGES[seniority]);
      }
    }
  });

  it('jest deterministyczny dla ziarna misji', () => {
    expect(createInitialState(DEFAULT_BALANCE, 42).staff).toEqual(
      createInitialState(DEFAULT_BALANCE, 42).staff,
    );
    expect(createInitialState(DEFAULT_BALANCE, 42).staff.candidates).not.toEqual(
      createInitialState(DEFAULT_BALANCE, 43).staff.candidates,
    );
  });
});

describe('HireCandidate (EMP-03, EMP-04, FIN-03, FIN-08, OFF-04)', () => {
  it('zatrudnia od razu, z cechami kandydata i należną dniówką za dziś', () => {
    const engine = engineFor();
    const forecastBefore = forecastCash(engine.getState(), DEFAULT_BALANCE).afterSettlement;
    const { candidate, result } = hireFirst(engine);

    expect(result).toEqual({ ok: true });
    const state = engine.getState();
    expect(Object.values(state.staff.employees)).toEqual([
      {
        id: 'employee-1',
        name: candidate.name,
        specialization: candidate.specialization,
        seniority: candidate.seniority,
        dailyWage: candidate.dailyWage,
        hiredOnDay: 1,
        deskId: 'furniture-1',
        projectId: null,
        energy: 100_000,
      },
    ]);
    expect(state.finance.wagesDueToday).toEqual({ 'employee-1': candidate.dailyWage });
    expect(forecastCash(state, DEFAULT_BALANCE).afterSettlement).toBe(
      forecastBefore - candidate.dailyWage,
    );
  });

  it('zastępuje zatrudnionego nowym kandydatem tej samej specjalizacji i seniority', () => {
    const engine = engineFor();
    const { candidate } = hireFirst(engine);
    const { candidates } = engine.getState().staff;

    expect(candidates).toHaveLength(SPECIALIZATIONS.length * SENIORITIES.length);
    expect(candidates.some((c) => c.id === candidate.id)).toBe(false);
    expect(candidates[0]).toMatchObject({
      specialization: candidate.specialization,
      seniority: candidate.seniority,
    });
  });

  it('przydziela kolejne wolne biurka, a bez biurka zatrudnia z brakiem stanowiska (EMP-04)', () => {
    const engine = engineFor();
    hireFirst(engine, 0);
    hireFirst(engine, 1);
    expect(freeDeskCount(engine.getState())).toBe(0);
    hireFirst(engine, 2);

    const desks = Object.values(engine.getState().staff.employees).map((e) => e.deskId);
    expect(desks).toEqual(['furniture-1', 'furniture-2', null]);
  });

  it('nowa osoba wchodzi drzwiami i idzie do punktu korzystania z własnego biurka', () => {
    const engine = engineFor(testState({ speed: 1 }));
    hireFirst(engine);
    const agent = engine.getState().world.movement.agents[0];
    const entrance = OFFICE_LAYOUT.doors.find((d) => d.isEntrance)?.position;
    expect(agent?.cell).toEqual(entrance);

    for (let i = 0; i < 200; i++) engine.step();

    const desk = engine.getState().world.furniture['furniture-1' as never];
    const deskPoint = desk ? interactionCells(desk)[0] : undefined;
    expect(engine.getState().world.movement.agents[0]).toMatchObject({
      cell: deskPoint,
      status: 'arrived',
    });
  });

  it('osoba bez biurka staje na wolnym polu, nie w drzwiach ani w punkcie korzystania', () => {
    const engine = engineFor();
    for (const index of [0, 1, 2]) hireFirst(engine, index);
    const state = engine.getState();
    const deskless = state.world.movement.agents.find((a) => a.id === 'employee-3');
    const goal = deskless?.tasks[0];
    if (goal?.kind !== 'goTo') throw new Error('brak celu');

    const forbidden = new Set([
      ...OFFICE_LAYOUT.doors.map((d) => cellKey(d.position)),
      ...movementEnvFor(state, DEFAULT_BALANCE).destinations.map((d) => cellKey(d.cell)),
    ]);
    expect(forbidden.has(cellKey(goal.cell))).toBe(false);
    expect(movementEnvFor(state, DEFAULT_BALANCE).grid.passable(goal.cell)).toBe(true);
  });

  it.each([
    ['przy długu', 'inDebt'],
    ['po zakończeniu pracy', 'phaseNotAllowed'],
    ['dla nieznanego kandydata', 'unknownCandidate'],
  ] as const)('odrzuca zatrudnienie %s bez zmiany stanu', (_, code) => {
    let state = testState(code === 'phaseNotAllowed' ? { phase: 'workEnded' } : {});
    if (code === 'inDebt') {
      const result = recordOperation(state, {
        key: 'event:debt',
        kind: 'event',
        amount: -state.finance.cash - 1,
      });
      if (!result.ok) throw new Error('setup');
      state = deepFreeze(result.state);
    }
    const engine = engineFor(state);
    const before = engine.getState();
    const candidateId =
      code === 'unknownCandidate'
        ? ('candidate-999' as CandidateId)
        : (before.staff.candidates[0]?.id ?? ('candidate-1' as CandidateId));

    expect(engine.dispatch({ type: 'HireCandidate', candidateId })).toEqual({
      ok: false,
      rejection: { code },
    });
    expect(engine.getState()).toBe(before);
  });

  it('następny dzień nalicza dniówkę każdemu zatrudnionemu (FIN-03)', () => {
    const engine = engineFor();
    hireFirst(engine, 0);
    hireFirst(engine, 3);
    const settled = engine.getState();
    const next = engineFor(
      deepFreeze({
        ...settled,
        mission: {
          ...settled.mission,
          phase: 'settled',
          timeInDayMs: 600_000,
          report: testReport(1, settled.finance.cash),
        },
      }),
    );

    next.dispatch({ type: 'StartNextDay' });

    const employees = Object.values(next.getState().staff.employees);
    expect(next.getState().finance.wagesDueToday).toEqual(
      Object.fromEntries(employees.map((e) => [e.id, e.dailyWage])),
    );
  });
});
