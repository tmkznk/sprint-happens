import { describe, expect, it } from 'vitest';
import { PEOPLE, personById } from '../domain/content/people';
import type { ProjectId } from '../domain/contracts';
import type { Employee, EmployeeId } from '../domain/employees';
import type { FurnitureId } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import type { GameState } from '../domain/state';
import { DEFAULT_BALANCE } from '../domain/config';
import { runUntilPhase, testEngine, testState } from '../test/engineFixture';
import { smokingSpotIds } from '../world/movement/officeEnv';
import { OFFICE_LAYOUT, PROLOGUE_LAYOUT } from '../world/officeLayout';
import type { OrderTarget } from './commands';
import { createEngine } from './engine';
import { beginArriving, beginLeaving, maxTransitSteps } from './commute';
import { activityOf, energyRates, isOnBreak, isSmokeTask } from './needs';
import { createPrologueState } from './prologue';
import { hasBadConditions } from './satisfaction';
import { cigaretteDue, cigaretteSlotsPassed, markCigarettesHandled } from './smoking';
import { DAY_LENGTH_MS } from './time';
import { isAtOwnDesk, isWorking } from './work';

// Harmonogram papierosów (stan palenia): deterministyczne pory z personId, bez RNG.

function slotTimes(personId: string, cigarettes: number): number[] {
  const times: number[] = [];
  let passed = 0;
  for (let t = 0; t <= DAY_LENGTH_MS; t += 1000) {
    const now = cigaretteSlotsPassed(personId, cigarettes, t);
    if (now > passed) {
      times.push(t);
      passed = now;
    }
  }
  return times;
}

function hiredSmoker(timeInDayMs: number): { state: GameState; employee: Employee } {
  const engine = testEngine({ timeInDayMs });
  const candidate = engine.getState().staff.candidates.find((c) => {
    return (PEOPLE.find((p) => p.id === c.personId)?.cigarettesPerDay ?? 0) > 0;
  });
  if (!candidate) throw new Error('brak kandydata-palacza');
  expect(engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id }).ok).toBe(true);
  const state = engine.getState();
  const employee = Object.values(state.staff.employees)[0] as Employee;
  return { state, employee };
}

describe('harmonogram papierosów', () => {
  it('8 papierosów: pory co 75 s (godzina zegara), 8 w ciągu dnia', () => {
    const times = slotTimes('person-a', 8);
    expect(times).toHaveLength(8);
    for (let i = 1; i < times.length; i++) {
      expect((times[i] as number) - (times[i - 1] as number)).toBe(75_000);
    }
    expect(cigaretteSlotsPassed('person-a', 8, DAY_LENGTH_MS)).toBe(8);
  });

  it('2 papierosy: pory co 300 s, 2 w ciągu dnia', () => {
    const times = slotTimes('person-a', 2);
    expect(times).toHaveLength(2);
    expect((times[1] as number) - (times[0] as number)).toBe(300_000);
  });

  it('osoby o tej samej liczbie papierosów mają różne pory, wynik stały dla personId', () => {
    const ids = ['person-a', 'person-b', 'person-c', 'person-d', 'person-e'];
    const firsts = ids.map((id) => slotTimes(id, 4)[0]);
    expect(new Set(firsts).size).toBeGreaterThan(1);
    expect(slotTimes('person-a', 4)).toEqual(slotTimes('person-a', 4));
  });

  it('0 papierosów: zawsze 0 minionych pór', () => {
    expect(cigaretteSlotsPassed('person-a', 0, 0)).toBe(0);
    expect(cigaretteSlotsPassed('person-a', 0, DAY_LENGTH_MS)).toBe(0);
  });

  it('zatrudniony o 14:00 nie ma zaległego papierosa', () => {
    const { state, employee } = hiredSmoker((DAY_LENGTH_MS * 5) / 8);
    const cigarettes = personById(employee.personId)?.cigarettesPerDay ?? 0;
    expect(cigarettes).toBeGreaterThan(0);
    expect(employee.cigarettesHandled).toBe(
      cigaretteSlotsPassed(employee.personId, cigarettes, (DAY_LENGTH_MS * 5) / 8),
    );
    expect(cigaretteDue(state, employee)).toBe(false);
  });

  it('rozkaz kasuje zaległą porę, a następna znów jest należna', () => {
    const { state, employee } = hiredSmoker(0);
    const due = { ...employee, cigarettesHandled: 0 };
    const later = { ...state, mission: { ...state.mission, timeInDayMs: DAY_LENGTH_MS / 2 } };
    expect(cigaretteDue(later, due)).toBe(true);
    const handled = markCigarettesHandled(later, due);
    expect(handled).not.toBe(due);
    expect(cigaretteDue(later, handled)).toBe(false);
    const end = { ...state, mission: { ...state.mission, timeInDayMs: DAY_LENGTH_MS } };
    expect(cigaretteDue(end, handled)).toBe(true);
  });

  it('rozkaz gracza oznacza miniony papieros jako obsłużony', () => {
    const { state, employee } = hiredSmoker(0);
    const late = {
      ...state,
      mission: { ...state.mission, timeInDayMs: DAY_LENGTH_MS / 2 },
      staff: {
        ...state.staff,
        employees: { [employee.id]: { ...employee, cigarettesHandled: 0 } },
      },
    };
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: late });
    const current = engine.getState().staff.employees[employee.id] as Employee;
    expect(cigaretteDue(engine.getState(), current)).toBe(true);
    const result = engine.dispatch({
      type: 'OrderEmployee',
      employeeId: employee.id,
      target: { kind: 'cell', cell: { x: 7, y: 10 } },
    });
    expect(result.ok).toBe(true);
    const after = engine.getState().staff.employees[employee.id] as Employee;
    expect(cigaretteDue(engine.getState(), after)).toBe(false);
  });

  it('w prologu papieros nigdy nie jest należny', () => {
    const { state, employee } = hiredSmoker(0);
    const late = { ...state, mission: { ...state.mission, timeInDayMs: DAY_LENGTH_MS } };
    const reset = { ...employee, cigarettesHandled: 0 };
    expect(cigaretteDue(late, reset)).toBe(true);
    const prologue = { ...late, prologue: {} as unknown as NonNullable<GameState['prologue']> };
    expect(cigaretteDue(prologue, reset)).toBe(false);
  });

  it('beginArriving zeruje cigarettesHandled', () => {
    const { state, employee } = hiredSmoker(DAY_LENGTH_MS);
    const busy = {
      ...state,
      staff: {
        ...state.staff,
        employees: { [employee.id]: { ...employee, cigarettesHandled: 3 } },
      },
    };
    const next = beginArriving(busy);
    expect(next.staff.employees[employee.id]?.cigarettesHandled).toBe(0);
  });
});

// Zachowanie palacza: decyzja w updateNeeds, wyjście na taras, powrót.

type Engine = ReturnType<typeof createEngine>;
type Person = (typeof PEOPLE)[number];

const P1 = 'project-1' as ProjectId;
const DESK_A = 'furniture-1' as FurnitureId;
const NEW_DESK = 'furniture-20' as FurnitureId;
const COFFEE_SPOT = 'furniture-4#0';
const NEW_DESK_ORIGIN: GridPoint = { x: 2, y: 11 };
const FLOOR: GridPoint = { x: 7, y: 10 };
const MID_DAY = DAY_LENGTH_MS / 2;
const RATES = energyRates(DEFAULT_BALANCE);
const E = (value: number) => value * 1000;

// Palacz z rzadszymi porami: w połowie dnia ma co najmniej dwie minione, a do następnej daleko.
const smokerOf = (specialization: string): Person => {
  const person = PEOPLE.filter(
    (p) => p.specialization === specialization && p.cigarettesPerDay >= 4,
  ).sort((x, y) => x.cigarettesPerDay - y.cigarettesPerDay)[0];
  if (!person) throw new Error(`brak palacza ${specialization}`);
  return person;
};
const nonSmokerOf = (specialization: string): Person => {
  const person = PEOPLE.find(
    (p) => p.specialization === specialization && p.cigarettesPerDay === 0,
  );
  if (!person) throw new Error(`brak niepalącego ${specialization}`);
  return person;
};

const engineFrom = (state: GameState): Engine =>
  createEngine({ config: DEFAULT_BALANCE, initialState: state });
const employee = (engine: Engine, id: EmployeeId) =>
  engine.getState().staff.employees[id] as Employee;
const agentOf = (engine: Engine, id: EmployeeId) => {
  const agent = engine.getState().world.movement.agents.find((a) => a.id === id);
  if (!agent) throw new Error(`brak postaci ${id}`);
  return agent;
};
const smoking = (engine: Engine, id: EmployeeId) => isSmokeTask(agentOf(engine, id));
const onSpot = (engine: Engine, id: EmployeeId) =>
  smoking(engine, id) && agentOf(engine, id).status === 'using';
const atDesk = (engine: Engine, id: EmployeeId) =>
  isAtOwnDesk(engine.getState(), employee(engine, id));
const working = (engine: Engine, id: EmployeeId) =>
  isWorking(engine.getState(), employee(engine, id), DEFAULT_BALANCE);
const passedNow = (engine: Engine, id: EmployeeId) => {
  const { personId } = employee(engine, id);
  return cigaretteSlotsPassed(
    personId,
    personById(personId)?.cigarettesPerDay ?? 0,
    engine.getState().mission.timeInDayMs,
  );
};
const order = (engine: Engine, employeeId: EmployeeId, target: OrderTarget) =>
  engine.dispatch({ type: 'OrderEmployee', employeeId, target });

function patched(engine: Engine, patch: (state: GameState) => GameState): Engine {
  return engineFrom(patch(engine.getState()));
}

function withEmployee(engine: Engine, id: EmployeeId, change: Partial<Employee>): Engine {
  return patched(engine, (state) => ({
    ...state,
    staff: {
      ...state.staff,
      employees: {
        ...state.staff.employees,
        [id]: { ...(state.staff.employees[id] as Employee), ...change },
      },
    },
  }));
}

function atTime(engine: Engine, timeInDayMs: number): Engine {
  return patched(engine, (state) => ({ ...state, mission: { ...state.mission, timeInDayMs } }));
}

// Papieros należny od zaraz.
const makeDue = (engine: Engine, id: EmployeeId) =>
  withEmployee(engine, id, { cigarettesHandled: passedNow(engine, id) - 1 });

// Przesuwa zegar na najbliższą porę tej osoby.
function atNextSlot(engine: Engine, id: EmployeeId): Engine {
  const { timeInDayMs } = engine.getState().mission;
  const { personId } = employee(engine, id);
  const cigarettes = personById(personId)?.cigarettesPerDay ?? 0;
  const before = cigaretteSlotsPassed(personId, cigarettes, timeInDayMs);
  for (let t = timeInDayMs; t <= DAY_LENGTH_MS; t += 100) {
    if (cigaretteSlotsPassed(personId, cigarettes, t) > before) return atTime(engine, t);
  }
  throw new Error('brak następnej pory');
}

function runUntil(engine: Engine, done: () => boolean, maxSteps = 3000) {
  for (let i = 0; i < maxSteps && !done(); i++) engine.step();
  expect(done()).toBe(true);
}

// Kontrakt, dwie osoby przy biurkach, południe; żadna nie ma zaległego papierosa.
function office(
  people: { a?: Person; b?: Person } = {},
  timeInDayMs: number = MID_DAY,
): { engine: Engine; a: EmployeeId; b: EmployeeId } {
  const start = engineFrom(testState());
  const starter = start.getState().contracts.offers[0];
  if (starter) start.dispatch({ type: 'AcceptOffer', offerId: starter.id });
  const ids: EmployeeId[] = [];
  for (const specialization of ['frontend', 'backend'] as const) {
    const candidate = start
      .getState()
      .staff.candidates.find((c) => c.specialization === specialization);
    if (!candidate) throw new Error('brak kandydata');
    start.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
    const id = Object.values(start.getState().staff.employees).at(-1)?.id as EmployeeId;
    start.dispatch({ type: 'AssignProject', employeeId: id, projectId: P1 });
    ids.push(id);
  }
  start.dispatch({ type: 'SetSpeed', speed: 1 });
  for (let i = 0; i < 400 && !ids.every((id) => atDesk(start, id)); i++) start.step();
  const [a, b] = ids as [EmployeeId, EmployeeId];
  const personA = people.a ?? smokerOf('frontend');
  const personB = people.b ?? nonSmokerOf('backend');
  const handledAt = (person: Person) =>
    cigaretteSlotsPassed(person.id, person.cigarettesPerDay, timeInDayMs);
  const engine = patched(start, (state) => ({
    ...state,
    mission: { ...state.mission, timeInDayMs },
    staff: {
      ...state.staff,
      employees: {
        ...state.staff.employees,
        [a]: {
          ...(state.staff.employees[a] as Employee),
          personId: personA.id,
          cigarettesHandled: handledAt(personA),
        },
        [b]: {
          ...(state.staff.employees[b] as Employee),
          personId: personB.id,
          cigarettesHandled: handledAt(personB),
        },
      },
    },
  }));
  expect(atDesk(engine, a) && atDesk(engine, b)).toBe(true);
  return { engine, a, b };
}

describe('zachowanie palacza', () => {
  it('należny papieros: wychodzi od biurka, dochodzi na miejsce terrace#, stoi czas papierosa i wraca do biurka', () => {
    const steps = RATES.cigaretteSteps;
    const { engine: base, a } = office();
    const engine = makeDue(base, a);
    const desk = { ...agentOf(engine, a).cell };
    expect(steps).toBe(
      (DEFAULT_BALANCE.smoking.cigaretteSeconds * 1000) / DEFAULT_BALANCE.simulation.stepMs,
    );

    engine.step();
    expect(agentOf(engine, a).tasks[0]).toEqual({
      kind: 'use',
      destinationIds: smokingSpotIds(OFFICE_LAYOUT),
      steps,
    });
    expect(agentOf(engine, a).tasks[1]).toEqual({ kind: 'goTo', cell: desk });
    expect(isOnBreak(engine.getState(), employee(engine, a))).toBe(true);

    runUntil(engine, () => onSpot(engine, a));
    expect(agentOf(engine, a).reservedDestination).toBe('terrace#0');
    expect(agentOf(engine, a).cell).toEqual(OFFICE_LAYOUT.smokingSpots[0]);
    // Pierwszy krok na miejscu to już usedSteps = 1; koniec po ostatnim kroku papierosa.
    expect(agentOf(engine, a).usedSteps).toBe(1);
    let more = 0;
    while (smoking(engine, a)) {
      expect(agentOf(engine, a).cell).toEqual(OFFICE_LAYOUT.smokingSpots[0]);
      engine.step();
      more++;
    }
    expect(more).toBe(steps - 1);
    expect(engine.getState().world.movement.reservations['terrace#0']).toBeUndefined();

    runUntil(engine, () => working(engine, a));
    expect(agentOf(engine, a).cell).toEqual(desk);
    expect(isOnBreak(engine.getState(), employee(engine, a))).toBe(false);
  });

  it('energia dokładnie ta sama od wyjścia do powrotu, praca w tym czasie stoi', () => {
    const { engine: base, a } = office();
    const engine = withEmployee(makeDue(base, a), a, { energy: E(80) });
    const progress = () => engine.getState().contracts.projects[P1]?.progress.frontend;
    const progressBefore = progress();

    engine.step();
    expect(smoking(engine, a)).toBe(true);
    let wasOnSpot = false;
    while (!working(engine, a)) {
      expect(employee(engine, a).energy).toBe(E(80));
      expect(progress()).toBe(progressBefore);
      wasOnSpot ||= onSpot(engine, a);
      engine.step();
    }
    expect(wasOnSpot).toBe(true);
    // Krok powrotu to pierwszy krok pracy: energia spada dopiero wtedy, o jedną stawkę.
    expect(employee(engine, a).energy).toBe(E(80) - RATES.drainPerStep);
    expect(progress()).toBeGreaterThan(progressBefore ?? -1);
  });

  it('dwóch palaczy naraz stoi na różnych polach', () => {
    const { engine: base, a, b } = office({ b: smokerOf('backend') });
    const engine = makeDue(makeDue(base, a), b);
    runUntil(engine, () => onSpot(engine, a) && onSpot(engine, b));
    const [first, second] = [agentOf(engine, a), agentOf(engine, b)];
    expect(first.reservedDestination).not.toBe(second.reservedDestination);
    expect(first.cell).not.toEqual(second.cell);
    runUntil(engine, () => working(engine, a) && working(engine, b));
  });

  it('rozkaz na tarasie: wykonuje rozkaz, papieros przepada; przy następnej porze idzie mimo breakHold', () => {
    const { engine: base, a } = office();
    const engine = makeDue(base, a);
    runUntil(engine, () => onSpot(engine, a));

    expect(order(engine, a, { kind: 'cell', cell: FLOOR })).toEqual({ ok: true });
    expect(smoking(engine, a)).toBe(false);
    expect(engine.getState().world.movement.reservations['terrace#0']).toBeUndefined();
    runUntil(engine, () => agentOf(engine, a).status === 'arrived');
    expect(agentOf(engine, a).cell).toEqual(FLOOR);
    for (let i = 0; i < 50; i++) {
      engine.step();
      expect(smoking(engine, a)).toBe(false);
    }

    const later = atNextSlot(engine, a);
    expect(employee(later, a).breakHold).toBe(true);
    later.step();
    expect(smoking(later, a)).toBe(true);
    runUntil(later, () => onSpot(later, a));
    runUntil(later, () => !smoking(later, a));
    runUntil(later, () => agentOf(later, a).status === 'arrived');
    expect(agentOf(later, a).cell).toEqual(FLOOR);
    expect(employee(later, a).breakHold).toBe(true);
  });

  it('rozkaz w drodze na taras kasuje papieros i zwalnia miejsce', () => {
    const { engine: base, a } = office();
    const engine = makeDue(base, a);
    runUntil(engine, () => smoking(engine, a) && agentOf(engine, a).reservedDestination !== null);
    expect(onSpot(engine, a)).toBe(false);

    expect(order(engine, a, { kind: 'furniture', furnitureId: DESK_A })).toEqual({ ok: true });
    expect(smoking(engine, a)).toBe(false);
    expect(engine.getState().world.movement.reservations['terrace#0']).toBeUndefined();
    expect(cigaretteDue(engine.getState(), employee(engine, a))).toBe(false);
    runUntil(engine, () => working(engine, a));
  });

  it.each([
    [true, true],
    [false, false],
  ])('palenie nie zmienia breakHold ani orderedRest (%s, %s)', (breakHold, orderedRest) => {
    const { engine: base, a } = office();
    const engine = withEmployee(makeDue(base, a), a, { breakHold, orderedRest });
    engine.step();
    expect(smoking(engine, a)).toBe(true);
    while (!working(engine, a)) {
      expect(employee(engine, a).breakHold).toBe(breakHold);
      expect(employee(engine, a).orderedRest).toBe(orderedRest);
      engine.step();
    }
    expect(employee(engine, a).breakHold).toBe(breakHold);
    expect(employee(engine, a).orderedRest).toBe(orderedRest);
  });

  it('papieros czeka na koniec kawy; kilka minionych pór daje jedno wyjście', () => {
    const { engine: base, a } = office();
    // Zegar tuż po porze: do następnej jest dość czasu na kawę i jeden papieros.
    const tired = withEmployee(atNextSlot(base, a), a, {
      energy: E(DEFAULT_BALANCE.energy.thresholds.prophylactic),
    });
    runUntil(tired, () => agentOf(tired, a).status === 'using');
    expect(agentOf(tired, a).reservedDestination).toBe(COFFEE_SPOT);

    // W trakcie kawy mijają co najmniej dwie pory.
    const engine = withEmployee(tired, a, { cigarettesHandled: 0 });
    expect(passedNow(engine, a)).toBeGreaterThanOrEqual(2);
    while (!smoking(engine, a)) {
      expect(employee(engine, a).cigarettesHandled).toBe(0);
      engine.step();
    }
    // Wyjście dopiero po kawie, przy biurku, i obejmuje wszystkie minione pory.
    expect(atDesk(engine, a)).toBe(true);
    expect(employee(engine, a).cigarettesHandled).toBe(passedNow(engine, a));
    runUntil(engine, () => onSpot(engine, a));
    runUntil(engine, () => !smoking(engine, a));
    // Drugiego wyjścia nie ma: po powrocie pracuje.
    runUntil(engine, () => working(engine, a) || smoking(engine, a));
    expect(smoking(engine, a)).toBe(false);
    expect(working(engine, a)).toBe(true);
  });

  it('przerwa z powodu energii ma pierwszeństwo przed papierosem w tym samym kroku', () => {
    const { engine: base, a } = office();
    const engine = withEmployee(makeDue(base, a), a, {
      energy: E(DEFAULT_BALANCE.energy.thresholds.prophylactic),
    });
    const handled = employee(engine, a).cigarettesHandled;

    engine.step();
    expect(smoking(engine, a)).toBe(false);
    expect(isOnBreak(engine.getState(), employee(engine, a))).toBe(true);
    expect(employee(engine, a).cigarettesHandled).toBe(handled);
    expect(cigaretteDue(engine.getState(), employee(engine, a))).toBe(true);

    // Papieros czeka i idzie po przerwie.
    runUntil(engine, () => smoking(engine, a));
    expect(atDesk(engine, a)).toBe(true);
    expect(employee(engine, a).energy).toBeGreaterThan(
      E(DEFAULT_BALANCE.energy.thresholds.prophylactic),
    );
  });

  it('osoba bez biurka i osoba na polu z rozkazu też wychodzą', () => {
    const { engine: base, a, b } = office({ b: smokerOf('backend') });
    expect(base.dispatch({ type: 'AssignDesk', employeeId: a, deskId: null })).toEqual({
      ok: true,
    });
    expect(order(base, b, { kind: 'cell', cell: FLOOR })).toEqual({ ok: true });
    runUntil(
      base,
      () => agentOf(base, a).status === 'arrived' && agentOf(base, b).status === 'arrived',
    );
    const standing = { ...agentOf(base, a).cell };

    const engine = makeDue(makeDue(base, a), b);
    engine.step();
    expect(smoking(engine, a)).toBe(true);
    expect(smoking(engine, b)).toBe(true);
    runUntil(engine, () => onSpot(engine, a) && onSpot(engine, b));
    runUntil(
      engine,
      () => agentOf(engine, a).status === 'arrived' && agentOf(engine, b).status === 'arrived',
    );
    expect(agentOf(engine, a).cell).toEqual(standing);
    expect(agentOf(engine, b).cell).toEqual(FLOOR);
  });

  it('brak wyjść w arriving, leaving i prologu', () => {
    // Przyjście: po południu byłby należny, ale dopiero „working” może wysłać na taras.
    const { engine: base, a } = office();
    const arriving = patched(base, (state) => beginArriving(state));
    expect(arriving.getState().mission.phase).toBe('arriving');
    while (arriving.getState().mission.phase === 'arriving') {
      arriving.step();
      for (const agent of arriving.getState().world.movement.agents) {
        expect(isSmokeTask(agent)).toBe(false);
      }
    }
    expect(cigaretteDue(arriving.getState(), employee(arriving, a))).toBe(true);
    runUntil(arriving, () => atDesk(arriving, a) && smoking(arriving, a), 50);

    // Wyjście: należny papieros nie zatrzymuje nikogo.
    const leaving = withEmployee(
      patched(office().engine, (state) => beginLeaving(state)),
      a,
      { cigarettesHandled: 0 },
    );
    expect(cigaretteDue(leaving.getState(), employee(leaving, a))).toBe(true);
    while (leaving.getState().mission.phase === 'leaving') {
      leaving.step();
      for (const agent of leaving.getState().world.movement.agents) {
        expect(isSmokeTask(agent)).toBe(false);
      }
    }
    expect(leaving.getState().mission.phase).toBe('workEnded');

    // Prolog: układ bez miejsc i żadnych wyjść, także gdy osoba ma pory papierosa.
    expect(smokingSpotIds(PROLOGUE_LAYOUT)).toEqual([]);
    const initial = createPrologueState(DEFAULT_BALANCE, 7);
    const [owner] = Object.values(initial.staff.employees);
    if (!owner) throw new Error('brak właściciela');
    const prologue = engineFrom({
      ...initial,
      mission: { ...initial.mission, timeInDayMs: MID_DAY, speed: 1 },
      staff: {
        ...initial.staff,
        employees: { [owner.id]: { ...owner, personId: smokerOf('frontend').id } },
      },
    });
    for (let i = 0; i < 300; i++) {
      prologue.step();
      for (const agent of prologue.getState().world.movement.agents) {
        expect(isSmokeTask(agent)).toBe(false);
      }
    }
    expect(agentOf(prologue, owner.id).status).toBe('arrived');
  });

  it('niepalący nigdy nie wychodzi', () => {
    const { engine, a, b } = office({ a: nonSmokerOf('frontend'), b: nonSmokerOf('backend') }, 0);
    while (engine.getState().mission.phase === 'working') {
      engine.step();
      if (engine.getState().mission.phase !== 'working') break;
      expect(smoking(engine, a)).toBe(false);
      expect(smoking(engine, b)).toBe(false);
    }
    expect(employee(engine, a).cigarettesHandled).toBe(0);
    expect(employee(engine, b).cigarettesHandled).toBe(0);
  });

  it('activityOf: onSmoke na miejscu, walking w drodze; satysfakcja nie spada przez palenie ani oczekiwanie na miejsce', () => {
    const { engine: base, a } = office();
    // Wszystkie miejsca zajęte: osoba czeka przy biurku w kolejce.
    const holders = Object.fromEntries(
      smokingSpotIds(OFFICE_LAYOUT).map((id) => [id, 'employee-99']),
    );
    const engine = patched(makeDue(base, a), (state) => ({
      ...state,
      world: {
        ...state.world,
        movement: { ...state.world.movement, reservations: holders },
      },
    }));
    const activity = () => activityOf(engine.getState(), employee(engine, a), working(engine, a));
    const expectContent = () => {
      expect(hasBadConditions(engine.getState(), employee(engine, a), DEFAULT_BALANCE)).toBe(false);
      expect(employee(engine, a).badConditionsMs).toBe(0);
      expect(employee(engine, a).satisfaction).toBe(satisfaction);
    };
    const satisfaction = employee(engine, a).satisfaction;
    for (let i = 0; i < 700; i++) {
      engine.step();
      expect(smoking(engine, a)).toBe(true);
      expect(agentOf(engine, a).reservedDestination).toBeNull();
      expect(activity()).toBe('walking');
      expectContent();
    }
    expect(agentOf(engine, a).status).toBe('queued');

    const free = patched(engine, (state) => ({
      ...state,
      world: { ...state.world, movement: { ...state.world.movement, reservations: {} } },
    }));
    const activityFree = () => activityOf(free.getState(), employee(free, a), working(free, a));
    const seen = new Set<string>();
    while (smoking(free, a)) {
      free.step();
      if (!smoking(free, a)) break;
      seen.add(activityFree());
      expect(activityFree()).toBe(onSpot(free, a) ? 'onSmoke' : 'walking');
      expect(hasBadConditions(free.getState(), employee(free, a), DEFAULT_BALANCE)).toBe(false);
      expect(employee(free, a).satisfaction).toBe(satisfaction);
    }
    expect(seen).toEqual(new Set(['walking', 'onSmoke']));
  });

  it('zwolnienie palacza na tarasie: rezerwacja wolna, kolejna osoba zajmuje miejsce', () => {
    const { engine: base, a, b } = office({ b: smokerOf('backend') });
    const engine = makeDue(base, a);
    runUntil(engine, () => onSpot(engine, a));
    expect(engine.getState().world.movement.reservations['terrace#0']).toBe(a);

    expect(engine.dispatch({ type: 'FireEmployee', employeeId: a }).ok).toBe(true);
    expect(engine.getState().world.movement.reservations['terrace#0']).toBeUndefined();

    const next = makeDue(engine, b);
    runUntil(next, () => onSpot(next, b));
    expect(agentOf(next, b).reservedDestination).toBe('terrace#0');
  });

  it('sprzedaż biurka palacza na tarasie: wraca do biura i nie utyka', () => {
    const { engine: base, a } = office();
    const engine = makeDue(base, a);
    runUntil(engine, () => onSpot(engine, a));
    engine.dispatch({ type: 'SetSpeed', speed: 0 });
    expect(engine.dispatch({ type: 'SellFurniture', furnitureId: DESK_A })).toEqual({ ok: true });
    engine.dispatch({ type: 'SetSpeed', speed: 1 });

    expect(onSpot(engine, a)).toBe(true);
    runUntil(engine, () => !smoking(engine, a));
    runUntil(engine, () => agentOf(engine, a).status === 'arrived');
    expect(engine.getState().world.movement.reservations['terrace#0']).toBeUndefined();
    expect(employee(engine, a).deskId).toBeNull();
  });

  it('przeniesienie biurka palacza na tarasie: po papierosie idzie do nowej pozycji i pracuje', () => {
    const { engine: base, a } = office();
    const engine = makeDue(base, a);
    runUntil(engine, () => onSpot(engine, a));
    engine.dispatch({ type: 'SetSpeed', speed: 0 });
    expect(
      engine.dispatch({
        type: 'MoveFurniture',
        furnitureId: DESK_A,
        origin: NEW_DESK_ORIGIN,
        rotation: 90,
      }),
    ).toEqual({ ok: true });
    engine.dispatch({ type: 'SetSpeed', speed: 1 });

    // Papieros trwa dalej — mebel nie ma związku z tarasem.
    expect(onSpot(engine, a)).toBe(true);
    runUntil(engine, () => !smoking(engine, a));
    runUntil(engine, () => working(engine, a));
    expect(atDesk(engine, a)).toBe(true);
  });

  it('zmiana biurka na tarasie: po papierosie idzie do nowego biurka i pracuje', () => {
    const { engine: base, a } = office();
    const engine = patched(makeDue(base, a), (state) => ({
      ...state,
      world: {
        ...state.world,
        furniture: {
          ...state.world.furniture,
          [NEW_DESK]: { id: NEW_DESK, type: 'desk', origin: { x: 6, y: 11 }, rotation: 0 },
        },
      },
    }));
    runUntil(engine, () => onSpot(engine, a));
    expect(engine.dispatch({ type: 'AssignDesk', employeeId: a, deskId: NEW_DESK })).toEqual({
      ok: true,
    });

    expect(onSpot(engine, a)).toBe(true);
    runUntil(engine, () => !smoking(engine, a));
    runUntil(engine, () => working(engine, a));
    expect(atDesk(engine, a)).toBe(true);
  });

  it('przeniesienie biurka w trakcie kawy: po kawie idzie do nowej pozycji i pracuje', () => {
    const { engine: base, a } = office();
    const engine = withEmployee(base, a, {
      energy: E(DEFAULT_BALANCE.energy.thresholds.prophylactic),
    });
    runUntil(engine, () => agentOf(engine, a).status === 'using');
    engine.dispatch({ type: 'SetSpeed', speed: 0 });
    expect(
      engine.dispatch({
        type: 'MoveFurniture',
        furnitureId: DESK_A,
        origin: NEW_DESK_ORIGIN,
        rotation: 90,
      }),
    ).toEqual({ ok: true });
    engine.dispatch({ type: 'SetSpeed', speed: 1 });

    runUntil(engine, () => agentOf(engine, a).status !== 'using');
    runUntil(engine, () => working(engine, a));
    expect(atDesk(engine, a)).toBe(true);
  });

  it('pełne biuro palaczy: cały dzień bez trwałych blokad, wyjście w limicie', () => {
    const engine = engineFrom(testState());
    for (const candidate of engine.getState().staff.candidates) {
      if (Object.keys(engine.getState().staff.employees).length >= 8) break;
      engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
    }
    const heavy = PEOPLE.filter((p) => p.cigarettesPerDay > 0).sort(
      (x, y) => y.cigarettesPerDay - x.cigarettesPerDay,
    );
    const ids = Object.keys(engine.getState().staff.employees) as EmployeeId[];
    expect(ids.length).toBeGreaterThanOrEqual(5);
    const crowded = patched(engine, (state) => ({
      ...state,
      mission: { ...state.mission, speed: 1 },
      staff: {
        ...state.staff,
        employees: Object.fromEntries(
          ids.map((id, index) => [
            id,
            {
              ...(state.staff.employees[id] as Employee),
              personId: (heavy[index] as Person).id,
            },
          ]),
        ) as GameState['staff']['employees'],
      },
    }));

    const standing = new Map<string, number>();
    let longest = 0;
    let trips = 0;
    let deadlocks = 0;
    while (crowded.getState().mission.phase === 'working') {
      crowded.step();
      for (const agent of crowded.getState().world.movement.agents) {
        expect(agent.status).not.toBe('noRoute');
        if (agent.status === 'deadlocked') deadlocks++;
        // Ile kroków z rzędu postać stoi w drodze (cel nieosiągnięty, bez ruchu).
        const waiting =
          !agent.move && (agent.status === 'waiting' || agent.status === 'deadlocked');
        const count = waiting ? (standing.get(agent.id) ?? 0) + 1 : 0;
        standing.set(agent.id, count);
        longest = Math.max(longest, count);
      }
    }
    for (const id of ids) trips += employee(crowded, id).cigarettesHandled;
    expect(trips).toBeGreaterThan(ids.length);
    expect(crowded.getState().mission.phase).toBe('leaving');
    let transit = 0;
    while (crowded.getState().mission.phase === 'leaving') {
      crowded.step();
      transit = Math.max(transit, crowded.getState().mission.transitSteps);
    }
    expect(transit).toBeLessThan(maxTransitSteps(DEFAULT_BALANCE) - 1);
    expect(longest).toBeLessThan(100);
    expect(deadlocks).toBe(0);
  });

  it('17:00: wszyscy z tarasu i dojścia wychodzą w limicie, następnego dnia brak zaległych papierosów', () => {
    const { engine: base, a, b } = office({ b: smokerOf('backend') });
    const onTerrace = makeDue(base, a);
    runUntil(onTerrace, () => onSpot(onTerrace, a));
    const both = makeDue(onTerrace, b);
    runUntil(both, () => smoking(both, b) && agentOf(both, b).move !== null);
    expect(onSpot(both, a)).toBe(true);

    // Ostatni krok dnia: papieros na tarasie i droga na taras przerwane.
    const engine = atTime(both, DAY_LENGTH_MS - DEFAULT_BALANCE.simulation.stepMs);
    engine.step();
    expect(engine.getState().mission.phase).toBe('leaving');
    const reservations = engine.getState().world.movement.reservations;
    expect(Object.keys(reservations)).toEqual([]);

    let transit = 0;
    while (engine.getState().mission.phase === 'leaving') {
      engine.step();
      transit = Math.max(transit, engine.getState().mission.transitSteps);
    }
    expect(engine.getState().mission.phase).toBe('workEnded');
    expect(transit).toBeLessThan(maxTransitSteps(DEFAULT_BALANCE) - 1);

    expect(engine.dispatch({ type: 'SettleDay' })).toEqual({ ok: true });
    expect(engine.dispatch({ type: 'StartNextDay' })).toEqual({ ok: true });
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    runUntilPhase(engine, 'working');
    for (const id of [a, b]) {
      expect(employee(engine, id).cigarettesHandled).toBe(0);
      expect(cigaretteDue(engine.getState(), employee(engine, id))).toBe(false);
      expect(smoking(engine, id)).toBe(false);
    }
  });

  it('tempo 1× i 4×: identyczny stan po dniu z palaczami', () => {
    const play = (speed: 1 | 4) => {
      const { engine, a, b } = office({ a: smokerOf('frontend'), b: smokerOf('backend') }, 0);
      engine.dispatch({ type: 'SetSpeed', speed });
      let trips = 0;
      let wasSmoking = false;
      while (engine.getState().mission.phase === 'working') {
        engine.step();
        for (const agent of engine.getState().world.movement.agents) {
          expect(agent.status).not.toBe('noRoute');
        }
        if (engine.getState().mission.phase !== 'working') break;
        const now = smoking(engine, a);
        if (now && !wasSmoking) trips++;
        wasSmoking = now;
      }
      runUntilPhase(engine, 'workEnded');
      expect(trips).toBeGreaterThan(0);
      expect(employee(engine, b).cigarettesHandled).toBeGreaterThan(0);
      return engine.getState();
    };
    expect(play(4)).toEqual(play(1));
  });
});
