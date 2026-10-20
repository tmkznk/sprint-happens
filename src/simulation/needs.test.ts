import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { ProjectId } from '../domain/contracts';
import type { Employee, EmployeeId, Seniority, Specialization } from '../domain/employees';
import type { FurnitureId } from '../domain/furniture';
import type { GameState } from '../domain/state';
import { testReport, testState } from '../test/engineFixture';
import { interactionCells } from '../world/geometry';
import { createEngine } from './engine';
import { activityOf, energyRates, isOnBreak } from './needs';
import { isAtOwnDesk, isWorking } from './work';

type Engine = ReturnType<typeof createEngine>;
const P1 = 'project-1' as ProjectId;
const COFFEE = 'furniture-4' as FurnitureId;
const SOFA = 'furniture-3' as FurnitureId;
const RATES = energyRates(DEFAULT_BALANCE);
const E = (value: number) => value * 1000;

function engineFrom(state: GameState): Engine {
  return createEngine({ config: DEFAULT_BALANCE, initialState: state });
}

// Kontrakt startowy (Frontend 60, Backend 40) i pracownicy przy biurkach, gra na 1×.
function office(
  roles: [Specialization, Seniority][],
  assign = true,
): { engine: Engine; ids: EmployeeId[] } {
  const engine = engineFrom(testState());
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
  for (let i = 0; i < 400 && !ids.every((id) => atDesk(engine, id)); i++) engine.step();
  return { engine, ids };
}

const employee = (engine: Engine, id: EmployeeId) =>
  engine.getState().staff.employees[id] as Employee;
const atDesk = (engine: Engine, id: EmployeeId) =>
  isAtOwnDesk(engine.getState(), employee(engine, id));
const agentOf = (engine: Engine, id: string) =>
  engine.getState().world.movement.agents.find((a) => a.id === id);

function withEnergy(engine: Engine, energies: Record<string, number>): Engine {
  const state = engine.getState();
  const employees = { ...state.staff.employees };
  for (const [id, energy] of Object.entries(energies)) {
    const current = employees[id as EmployeeId];
    if (current) employees[id as EmployeeId] = { ...current, energy };
  }
  return engineFrom({ ...state, staff: { ...state.staff, employees } });
}

function run(engine: Engine, steps: number, onStep?: () => void) {
  for (let i = 0; i < steps; i++) {
    engine.step();
    onStep?.();
  }
}

describe('energia (NEED-01, SH-032 B2)', () => {
  it('maleje wyłącznie podczas pracy, zgodnie z konfiguracją', () => {
    const { engine, ids } = office([['frontend', 'senior']]);
    const [worker] = ids as [EmployeeId];
    const idle = office([['frontend', 'senior']], false);
    const before = employee(engine, worker).energy;

    run(engine, 600);
    run(idle.engine, 600);

    expect(before - employee(engine, worker).energy).toBe(600 * RATES.drainPerStep);
    expect(employee(idle.engine, idle.ids[0] as EmployeeId).energy).toBe(E(100));
  });

  it('niższa energia oznacza niższą wydajność; przy zerze praca stoi i osoba szuka odpoczynku', () => {
    const { engine, ids } = office([['frontend', 'senior']]);
    const [worker] = ids as [EmployeeId];
    const progress = (e: Engine) => e.getState().contracts.projects[P1]?.progress.frontend ?? 0;

    const full = withEnergy(engine, { [worker]: E(100) });
    const before = progress(full);
    run(full, 10);
    const fullRate = progress(full) - before;

    const tired = withEnergy(engine, { [worker]: E(70) });
    run(tired, 10);
    expect(progress(tired) - before).toBeLessThan(fullRate);

    const empty = withEnergy(engine, { [worker]: 0 });
    expect(isWorking(empty.getState(), employee(empty, worker))).toBe(false);
    run(empty, 1);
    expect(progress(empty)).toBe(before);
    expect(isOnBreak(empty.getState(), employee(empty, worker))).toBe(true);
  });

  it('noc przywraca pełną energię (TIME-05, SH-004 A4c)', () => {
    const { engine, ids } = office([['frontend', 'junior']]);
    const tired = withEnergy(engine, { [ids[0] as string]: E(20) });
    const state = tired.getState();
    const settled = engineFrom({
      ...state,
      mission: {
        ...state.mission,
        phase: 'settled',
        speed: 0,
        timeInDayMs: 600_000,
        report: testReport(1, state.finance.cash),
      },
    });

    settled.dispatch({ type: 'StartNextDay' });

    expect(employee(settled, ids[0] as EmployeeId).energy).toBe(E(100));
  });
});

describe('przerwy (NEED-02, SH-004 A3/A4)', () => {
  it('profilaktyczna kawa tylko przy wolnym ekspresie; potem powrót do biurka', () => {
    const { engine, ids } = office([['frontend', 'junior']]);
    const [worker] = ids as [EmployeeId];
    const tired = withEnergy(engine, { [worker]: E(55) });

    run(tired, 1);
    const task = agentOf(tired, worker)?.tasks[0];
    expect(task).toMatchObject({ kind: 'use', destinationIds: ['furniture-4#0'] });

    let gained = 0;
    let previous = employee(tired, worker).energy;
    run(tired, 400, () => {
      const now = employee(tired, worker).energy;
      if (now > previous) gained += now - previous;
      previous = now;
    });
    // SH-004 A3: kawa daje stopniowo dokładnie konfigurowany przyrost; potem osoba wraca do biurka.
    expect(gained).toBe(RATES.coffeeGainPerStep * RATES.coffeeSteps);
    expect(atDesk(tired, worker)).toBe(true);
    expect(isOnBreak(tired.getState(), employee(tired, worker))).toBe(false);
  });

  it('bez przerwy profilaktycznej, gdy ekspres jest zajęty — osoba pracuje dalej', () => {
    const { engine, ids } = office([
      ['frontend', 'junior'],
      ['backend', 'junior'],
    ]);
    const [a, b] = ids as [EmployeeId, EmployeeId];
    const both = withEnergy(engine, { [a]: E(55), [b]: E(55) });

    run(both, 2);

    const breaks = [a, b].filter((id) => isOnBreak(both.getState(), employee(both, id)));
    expect(breaks).toHaveLength(1);
    expect(isWorking(both.getState(), employee(both, b === breaks[0] ? a : b))).toBe(true);
  });

  it('przy wyczerpaniu preferowana kanapa; po wypoczęciu koniec odpoczynku', () => {
    const { engine, ids } = office([['frontend', 'junior']]);
    const [worker] = ids as [EmployeeId];
    const exhausted = withEnergy(engine, { [worker]: E(10) });

    run(exhausted, 1);
    expect(agentOf(exhausted, worker)?.tasks[0]).toMatchObject({
      kind: 'use',
      destinationIds: ['furniture-3#0', 'furniture-3#1'],
    });

    let maxEnergy = 0;
    run(exhausted, RATES.maxRestSteps + 300, () => {
      maxEnergy = Math.max(maxEnergy, employee(exhausted, worker).energy);
    });
    // Odpoczynek kończy się po progu wypoczęcia (90) albo po maksymalnym czasie (SH-004 A4b).
    expect(maxEnergy).toBeGreaterThanOrEqual(E(Math.min(90, 10 + RATES.maxRestSteps * 0.1)) - 100);
    expect(isOnBreak(exhausted.getState(), employee(exhausted, worker))).toBe(false);
  });

  it('gdy kanapa i ekspres są zajęte, czeka bez regeneracji i bez zużycia energii', () => {
    const { engine, ids } = office([
      ['frontend', 'junior'],
      ['backend', 'junior'],
    ]);
    // Kanapę i ekspres zajmują „obce” rezerwacje — symulacja pełnego wyposażenia.
    const state = withEnergy(engine, { [ids[0] as string]: E(10) }).getState();
    const blocked = engineFrom({
      ...state,
      world: {
        ...state.world,
        movement: {
          ...state.world.movement,
          reservations: {
            'furniture-3#0': 'employee-2',
            'furniture-3#1': 'employee-2',
            'furniture-4#0': 'employee-2',
          },
        },
      },
    });
    const waiting = ids[0] as EmployeeId;

    run(blocked, 30);

    expect(activityOf(blocked.getState(), employee(blocked, waiting), false)).toBe(
      'waitingForRest',
    );
    expect(employee(blocked, waiting).energy).toBe(E(10));
  });

  it('przerwana kawa zachowuje odzyskaną energię bez podwajania (OFF-07, SH-004 A3)', () => {
    const { engine, ids } = office([['frontend', 'junior']]);
    const [worker] = ids as [EmployeeId];
    const tired = withEnergy(engine, { [worker]: E(30) });
    run(tired, 400, () => undefined);
    // Druga kawa: ponownie poniżej progu — brak odstępu między kawami (NEED-02).
    const again = withEnergy(tired, { [worker]: E(30) });
    for (let i = 0; i < 300 && agentOf(again, worker)?.status !== 'using'; i++) again.step();
    run(again, 50);
    const during = employee(again, worker).energy;
    expect(during).toBeGreaterThan(E(30));

    again.dispatch({ type: 'SetSpeed', speed: 0 });
    expect(again.dispatch({ type: 'SellFurniture', furnitureId: COFFEE }).ok).toBe(true);
    again.dispatch({ type: 'SetSpeed', speed: 1 });
    run(again, 5);

    expect(employee(again, worker).energy).toBeGreaterThanOrEqual(during - 5 * RATES.drainPerStep);
    expect(employee(again, worker).energy).toBeLessThan(during + RATES.coffeeGainPerStep);
  });

  it('bez żadnego miejsca odpoczynku osoba z zerową energią jest wyczerpana (NEED-02)', () => {
    const { engine, ids } = office([['frontend', 'junior']]);
    const [worker] = ids as [EmployeeId];
    engine.dispatch({ type: 'SetSpeed', speed: 0 });
    engine.dispatch({ type: 'SellFurniture', furnitureId: COFFEE });
    engine.dispatch({ type: 'SellFurniture', furnitureId: SOFA });
    const empty = withEnergy(engine, { [worker]: 0 });
    empty.dispatch({ type: 'SetSpeed', speed: 1 });

    run(empty, 5);

    expect(activityOf(empty.getState(), employee(empty, worker), false)).toBe('exhausted');
  });

  it('po przerwie postać wraca do punktu własnego biurka (OFF-04)', () => {
    const { engine, ids } = office([['frontend', 'junior']]);
    const [worker] = ids as [EmployeeId];
    const desk = engine.getState().world.furniture[employee(engine, worker).deskId as FurnitureId];
    // Po jednej kawie (+15) energia przekracza próg profilaktyczny — kolejnej przerwy nie będzie.
    const tired = withEnergy(engine, { [worker]: E(50) });

    run(tired, 600);

    expect(agentOf(tired, worker)?.cell).toEqual(desk ? interactionCells(desk)[0] : null);
  });
});
