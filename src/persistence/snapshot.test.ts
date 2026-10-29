/* eslint-disable @typescript-eslint/no-explicit-any -- testy celowo psują surowy JSON zapisu */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { POINT_SCALE } from '../domain/contracts';
import type { FurnitureId } from '../domain/furniture';
import { createAgent } from '../domain/movement';
import { createInitialState, type GameState } from '../domain/state';
import type { EmployeeId } from '../domain/employees';
import { createEngine } from '../simulation/engine';
import { createPrologueState } from '../simulation/prologue';
import { runUntilPhase } from '../test/engineFixture';
import { createPlayer } from '../test/player';
import { DAY_LENGTH_MS } from '../simulation/time';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import type { ValidationContext } from './schema';
import { parseSnapshot, SCHEMA_VERSION, serializeSnapshot, type SnapshotMeta } from './snapshot';

const context: ValidationContext = { config: DEFAULT_BALANCE, layout: OFFICE_LAYOUT };
const meta: SnapshotMeta = {
  gameBuildVersion: '0.0.0',
  revision: 7,
  savedAt: '2026-10-20T12:00:00.000Z',
};

function roundTrip(state: GameState): GameState {
  const serialized = serializeSnapshot(state, meta, context);
  if (!serialized.ok) throw new Error(serialized.error.issues.join('\n'));
  const parsed = parseSnapshot(serialized.json, context);
  if (!parsed.ok) throw new Error(parsed.error.issues.join('\n'));
  return parsed.envelope.state;
}

// Stan po pełnym dniu: koniec pracy, rozliczenie, raport — oraz kolejny dzień w trakcie.
function statesThroughDay(): GameState[] {
  const engine = createEngine({
    config: DEFAULT_BALANCE,
    initialState: createInitialState(DEFAULT_BALANCE, 99),
  });
  const states = [engine.getState()];
  engine.dispatch({ type: 'SetSpeed', speed: 2 });
  runUntilPhase(engine, 'workEnded');
  states.push(engine.getState());
  expect(engine.dispatch({ type: 'SettleDay' })).toEqual({ ok: true });
  states.push(engine.getState());
  expect(engine.dispatch({ type: 'StartNextDay' })).toEqual({ ok: true });
  engine.dispatch({ type: 'SetSpeed', speed: 1 });
  for (let i = 0; i < 1234; i++) engine.step();
  states.push(engine.getState());
  return states;
}

function withJsonEdit(edit: (state: Record<string, any>) => void): string {
  const envelope = JSON.parse(
    JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      ...meta,
      state: createInitialState(DEFAULT_BALANCE, 1),
    }),
  ) as { state: Record<string, any> };
  edit(envelope.state);
  return JSON.stringify(envelope);
}

function expectInvalidState(json: string, fragment: string) {
  const result = parseSnapshot(json, context);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe('invalidState');
  expect(result.error.issues.join('\n')).toContain(fragment);
}

describe('round-trip migawki (SH-037)', () => {
  it('stan początkowy po zapisie i odczycie jest równoważny', () => {
    const initial = createInitialState(DEFAULT_BALANCE, 12345);

    expect(roundTrip(initial)).toEqual(initial);
  });

  it.each(['start', 'koniec pracy', 'po rozliczeniu', 'w trakcie dnia 2'].map((n, i) => [n, i]))(
    'stan „%s” po zapisie i odczycie jest równoważny',
    (_, index) => {
      const state = statesThroughDay()[index as number];
      if (!state) throw new Error('brak stanu');
      expect(roundTrip(state)).toEqual(state);
    },
  );

  it('odtworzony stan daje identyczną dalszą symulację (stan RNG i zegar w zapisie)', () => {
    const [, , , midDay] = statesThroughDay();
    if (!midDay) throw new Error('brak stanu');
    const original = createEngine({ config: DEFAULT_BALANCE, initialState: midDay });
    const restored = createEngine({ config: DEFAULT_BALANCE, initialState: roundTrip(midDay) });
    for (let i = 0; i < 500; i++) {
      original.step();
      restored.step();
    }
    expect(restored.getState()).toEqual(original.getState());
  });

  it('zatrudnieni pracownicy w trakcie przejścia przetrwają zapis; ruch toczy się dalej identycznie', () => {
    const engine = createEngine({
      config: DEFAULT_BALANCE,
      initialState: createInitialState(DEFAULT_BALANCE, 5),
    });
    for (const candidate of engine.getState().staff.candidates.slice(0, 3)) {
      expect(engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id })).toEqual({
        ok: true,
      });
    }
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    // Biurko w open space stoi tuż przy wejściu — po 10 krokach część osób jest jeszcze w drodze.
    for (let i = 0; i < 10; i++) engine.step();
    const mid = engine.getState();
    expect(mid.world.movement.agents.some((a) => a.move !== null)).toBe(true);
    expect(Object.keys(mid.staff.employees)).toHaveLength(3);

    const restored = createEngine({ config: DEFAULT_BALANCE, initialState: roundTrip(mid) });
    for (let i = 0; i < 150; i++) {
      engine.step();
      restored.step();
    }
    expect(restored.getState()).toEqual(engine.getState());
  });

  it('koperta zawiera wersję formatu i metadane zapisu', () => {
    const serialized = serializeSnapshot(createInitialState(DEFAULT_BALANCE, 1), meta, context);
    if (!serialized.ok) throw new Error('zapis odrzucony');

    expect(JSON.parse(serialized.json)).toMatchObject({ schemaVersion: SCHEMA_VERSION, ...meta });
  });
});

describe('odrzucanie zapisu', () => {
  it('niepoprawny JSON', () => {
    expect(parseSnapshot('{nie-json', context)).toMatchObject({
      ok: false,
      error: { code: 'invalidJson' },
    });
  });

  it('brak pól koperty', () => {
    expect(parseSnapshot(JSON.stringify({ state: {} }), context)).toMatchObject({
      ok: false,
      error: { code: 'invalidEnvelope' },
    });
  });

  it('zapis z nowszej wersji gry (SH-004 A6b)', () => {
    const json = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, ...meta, state: {} });
    expect(parseSnapshot(json, context)).toMatchObject({
      ok: false,
      error: { code: 'newerVersion' },
    });
  });

  it('starszy format wymaga migracji', () => {
    const json = JSON.stringify({ schemaVersion: 0, ...meta, state: {} });
    expect(parseSnapshot(json, context)).toMatchObject({
      ok: false,
      error: { code: 'invalidEnvelope' },
    });
  });

  it('nieznane pole w stanie', () => {
    expectInvalidState(
      withJsonEdit((s) => (s.debug = true)),
      'Unrecognized key',
    );
  });

  it('niepoprawne ID mebla', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        const item = s.world.furniture['furniture-1'];
        s.world.furniture = { 'krzeslo-1': { ...item, id: 'krzeslo-1' } };
      }),
      'world.furniture.krzeslo-1',
    );
  });

  it('klucz mebla różny od jego ID', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.world.furniture['furniture-1'].id = 'furniture-2';
      }),
      'Klucz różny od ID mebla',
    );
  });

  it('ID spoza przydzielonej sekwencji (kolizja z przyszłymi ID)', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.ids.furniture = 2;
      }),
      'spoza przydzielonej sekwencji',
    );
  });

  it('kolizja mebli na jednym polu', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.world.furniture['furniture-2'].origin = s.world.furniture['furniture-1'].origin;
      }),
      'koliduje',
    );
  });

  it('mebel na ścianie', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.world.furniture['furniture-1'].origin = { x: 0, y: 0 };
      }),
      'poza podłogą',
    );
  });

  it('rozliczony dzień bez raportu (ochrona przed podwójnym rozliczeniem)', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.mission.phase = 'settled';
        s.mission.timeInDayMs = DAY_LENGTH_MS;
      }),
      'Raport niezgodny',
    );
  });

  it('czas dnia poza siatką kroków', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.mission.timeInDayMs = 150;
      }),
      'poza siatką kroków',
    );
  });

  it('stan w fazie arriving przechodzi walidację', () => {
    const state = createInitialState(DEFAULT_BALANCE, 1);
    const arriving = {
      ...state,
      mission: { ...state.mission, phase: 'arriving' as const, speed: 1 as const },
    };
    expect(roundTrip(arriving).mission).toMatchObject({
      phase: 'arriving',
      timeInDayMs: 0,
      speed: 1,
    });
  });

  it('stan w fazie leaving przechodzi walidację', () => {
    const state = createInitialState(DEFAULT_BALANCE, 1);
    const leaving = {
      ...state,
      mission: {
        ...state.mission,
        phase: 'leaving' as const,
        timeInDayMs: DAY_LENGTH_MS,
        speed: 4 as const,
      },
    };
    expect(roundTrip(leaving).mission).toMatchObject({ phase: 'leaving', speed: 4 });
  });

  it('arriving z timeInDayMs > 0 jest odrzucany', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.mission.phase = 'arriving';
        s.mission.timeInDayMs = 100;
      }),
      'Przyjście',
    );
  });

  it('workEnded z tempem > 0 nadal odrzucany', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.mission.phase = 'workEnded';
        s.mission.timeInDayMs = DAY_LENGTH_MS;
        s.mission.speed = 1;
      }),
      'Po końcu pracy',
    );
  });

  it('stan generatora losowego poza zakresem uint32', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.rng = -1;
      }),
      'rng',
    );
  });
});

describe('fragmenty i ukryte błędy w zapisie (SH-022)', () => {
  it('fragmenty z błędami przetrwają zapis; niezgodna liczba fragmentów jest odrzucana', () => {
    const engine = createEngine({
      config: DEFAULT_BALANCE,
      initialState: createInitialState(DEFAULT_BALANCE, 8),
    });
    const offer = engine.getState().contracts.offers[0];
    if (!offer) throw new Error('brak oferty');
    engine.dispatch({ type: 'AcceptOffer', offerId: offer.id });
    const senior = engine
      .getState()
      .staff.candidates.find((c) => c.specialization === 'frontend' && c.seniority === 'senior');
    if (!senior) throw new Error('brak kandydata');
    engine.dispatch({ type: 'HireCandidate', candidateId: senior.id });
    engine.dispatch({
      type: 'AssignProject',
      employeeId: 'employee-1' as never,
      projectId: 'project-1' as never,
    });
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    for (let i = 0; i < 2000; i++) engine.step();
    const state = engine.getState();
    expect(state.contracts.projects['project-1' as never]?.fragments.length).toBeGreaterThan(0);

    expect(roundTrip(state)).toEqual(state);

    const envelope = JSON.parse(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...meta, state }),
    ) as { state: Record<string, any> };
    envelope.state.contracts.projects['project-1'].fragments.pop();
    const result = parseSnapshot(JSON.stringify(envelope), context);
    expect(result.ok ? '' : result.error.issues.join('\n')).toContain('Fragmenty frontend');

    const overTested = JSON.parse(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...meta, state }),
    ) as { state: Record<string, any> };
    overTested.state.contracts.projects['project-1'].fragments[0].testProgress = 11 * POINT_SCALE;
    const rejected = parseSnapshot(JSON.stringify(overTested), context);
    expect(rejected.ok ? '' : rejected.error.issues.join('\n')).toContain('Postęp testów');

    // BUG-06: naprawa niewykrytego (nieprzetestowanego) błędu jest niespójna.
    const repairedHidden = JSON.parse(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...meta, state }),
    ) as { state: Record<string, any> };
    repairedHidden.state.contracts.projects['project-1'].fragments[0].repairProgress = 1;
    const hidden = parseSnapshot(JSON.stringify(repairedHidden), context);
    expect(hidden.ok ? '' : hidden.error.issues.join('\n')).toContain('Naprawa niewykrytego');

    // PROJ-10: design ponad zakres jest niespójny.
    const overDesigned = JSON.parse(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...meta, state }),
    ) as { state: Record<string, any> };
    const saved = overDesigned.state.contracts.projects['project-1'];
    saved.designProgress = saved.designScope * POINT_SCALE + 1;
    const design = parseSnapshot(JSON.stringify(overDesigned), context);
    expect(design.ok ? '' : design.error.issues.join('\n')).toContain('Postęp designu');
  });
});

describe('oddanie projektu w zapisie (SH-026)', () => {
  it('oddany projekt przetrwa zapis; raport bez statusu „oddany” jest odrzucany', () => {
    const engine = createEngine({
      config: DEFAULT_BALANCE,
      initialState: createInitialState(DEFAULT_BALANCE, 8),
    });
    const offer = engine.getState().contracts.offers[0];
    if (!offer) throw new Error('brak oferty');
    engine.dispatch({ type: 'AcceptOffer', offerId: offer.id });
    const accepted = engine.getState();
    const project = accepted.contracts.projects['project-1' as never];
    if (!project) throw new Error('brak projektu');
    const scopes = Object.entries(project.scopes) as [string, number][];
    const done = createEngine({
      config: DEFAULT_BALANCE,
      initialState: {
        ...accepted,
        contracts: {
          ...accepted.contracts,
          projects: {
            ...accepted.contracts.projects,
            [project.id]: {
              ...project,
              progress: Object.fromEntries(scopes.map(([s, pp]) => [s, pp * POINT_SCALE])),
              fragments: scopes.flatMap(([s, pp]) =>
                Array.from({ length: pp / 10 }, (_, i) => ({
                  specialization: s as never,
                  hasBug: i === 0,
                  testProgress: 0,
                  repairProgress: 0,
                })),
              ),
            },
          },
        },
      },
    });
    expect(done.dispatch({ type: 'DeliverProject', projectId: project.id })).toEqual({ ok: true });
    const state = done.getState();
    expect(roundTrip(state)).toEqual(state);

    const envelope = JSON.parse(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...meta, state }),
    ) as { state: Record<string, any> };
    envelope.state.contracts.projects['project-1'].status = 'active';
    const result = parseSnapshot(JSON.stringify(envelope), context);
    expect(result.ok ? '' : result.error.issues.join('\n')).toContain('Raport oddania');
  });
});

describe('zadowolenie i odejścia w zapisie (SH-019)', () => {
  it('zadowolenie, liczniki i historia odejść przetrwają zapis', () => {
    const engine = createEngine({
      config: DEFAULT_BALANCE,
      initialState: createInitialState(DEFAULT_BALANCE, 8),
    });
    for (const candidate of engine.getState().staff.candidates.slice(0, 2)) {
      engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
    }
    engine.dispatch({ type: 'SetSpeed', speed: 1 });
    for (let i = 0; i < 300; i++) engine.step();
    engine.dispatch({ type: 'FireEmployee', employeeId: 'employee-1' as never });
    const state = engine.getState();
    expect(state.staff.departures).toHaveLength(1);
    expect(roundTrip(state)).toEqual(state);
  });
});

describe('zdarzenia w zapisie (SH-031)', () => {
  it('oczekująca decyzja przetrwa zapis; zdarzenie dla nieznanego projektu jest odrzucane', () => {
    const initial = createInitialState(DEFAULT_BALANCE, 8);
    const state: GameState = {
      ...initial,
      ids: { ...initial.ids, event: 1 },
      events: {
        ...initial.events,
        pending: {
          instanceId: 'event-1',
          templateId: 'open-day',
          projectId: null,
          resumeSpeed: 2,
        },
        lastSeenDay: { 'open-day': 1 },
      },
    };
    expect(roundTrip(state)).toEqual(state);

    const envelope = JSON.parse(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...meta, state }),
    ) as { state: Record<string, any> };
    envelope.state.events.pending.projectId = 'project-7';
    const result = parseSnapshot(JSON.stringify(envelope), context);
    expect(result.ok ? '' : result.error.issues.join('\n')).toContain('nieznanego projektu');
  });
});

describe('kontrakty w zapisie (SH-020)', () => {
  it('przyjęty kontrakt i uzupełniona tablica przetrwają zapis', () => {
    const engine = createEngine({
      config: DEFAULT_BALANCE,
      initialState: createInitialState(DEFAULT_BALANCE, 3),
    });
    const offer = engine.getState().contracts.offers[1];
    if (!offer) throw new Error('brak oferty');
    engine.dispatch({ type: 'AcceptOffer', offerId: offer.id });

    expect(roundTrip(engine.getState())).toEqual(engine.getState());
  });

  it('odrzuca projekt bez zaliczki w księdze i z terminem niezgodnym z TIME-08', () => {
    const engine = createEngine({
      config: DEFAULT_BALANCE,
      initialState: createInitialState(DEFAULT_BALANCE, 1),
    });
    const offer = engine.getState().contracts.offers[0];
    if (!offer) throw new Error('brak oferty');
    engine.dispatch({ type: 'AcceptOffer', offerId: offer.id });
    const envelope = JSON.parse(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...meta, state: engine.getState() }),
    ) as { state: Record<string, any> };
    envelope.state.contracts.projects['project-1'].deadlineDay = 99;
    envelope.state.finance.ledger = [];
    envelope.state.finance.cash = envelope.state.finance.openingCash;

    const result = parseSnapshot(JSON.stringify(envelope), context);
    expect(result.ok).toBe(false);
    const issues = result.ok ? '' : result.error.issues.join('\n');
    expect(issues).toContain('Termin niezgodny');
    expect(issues).toContain('Brak zaliczki');
  });
});

describe('odrzucanie niespójnych finansów (SH-027)', () => {
  it('saldo niezgodne z księgą', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.finance.cash += 1;
      }),
      'niezgodne z księgą',
    );
  });

  it('powtórzona operacja w księdze', () => {
    const entry = { key: 'advance:c-1', day: 1, kind: 'advance', amount: 10, ref: null };
    expectInvalidState(
      withJsonEdit((s) => {
        s.finance.ledger = [entry, entry];
        s.finance.cash += 20;
      }),
      'Powtórzona operacja',
    );
  });

  it('operacja z przyszłego dnia', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.finance.ledger = [{ key: 'x', day: 9, kind: 'event', amount: 0, ref: null }];
      }),
      'przyszłego dnia',
    );
  });
});

describe('odrzucanie niespójnego ruchu', () => {
  const withAgents = (agents: object[], reservations: Record<string, string> = {}) =>
    withJsonEdit((s) => {
      s.world.movement = { step: 10, agents, reservations };
    });
  const base = createAgent('employee-1', { x: 5, y: 6 });

  it('dwie postacie na jednym polu (MOVE-04)', () => {
    expectInvalidState(withAgents([base, { ...base, id: 'employee-2' }]), 'zajęte także przez');
  });

  it('postać na ścianie lub meblu', () => {
    expectInvalidState(withAgents([{ ...base, cell: { x: 2, y: 7 } }]), 'na przeszkodzie');
  });

  it('przejście dalej niż na sąsiednie pole', () => {
    expectInvalidState(
      withAgents([{ ...base, move: { to: { x: 7, y: 6 }, elapsed: 0 } }]),
      'sąsiednie pole',
    );
  });

  it('rezerwacja nieistniejącej postaci lub miejsca', () => {
    expectInvalidState(withAgents([base], { 'furniture-4#0': 'employee-9' }), 'nie ma');
    expectInvalidState(
      withAgents([{ ...base, reservedDestination: 'furniture-9#0' }], {
        'furniture-9#0': 'employee-1',
      }),
      'nieistniejącego miejsca',
    );
  });
});

describe('wyjście z biura w zapisie (TIME-08)', () => {
  // Dwóch pracowników przy biurkach; dzień kończy się i wszyscy idą do drzwi.
  function leavingPlayer() {
    const player = createPlayer();
    const project = player.acceptStarter();
    player.assign(player.hire('frontend', 'junior'), project);
    player.assign(player.hire('backend', 'junior'), project);
    if (!player.runUntil((s) => s.mission.phase !== 'working')) throw new Error('brak końca dnia');
    return player;
  }

  it('stan w środku leaving przetrwa zapis; dalsze kroki są identyczne', () => {
    const player = leavingPlayer();
    for (let i = 0; i < 5; i++) player.engine.step();
    const mid = player.state();
    expect(mid.mission).toMatchObject({ phase: 'leaving', transitSteps: 5 });
    expect(mid.world.movement.agents.length).toBeGreaterThan(0);
    expect(roundTrip(mid)).toEqual(mid);

    const restored = createEngine({ config: DEFAULT_BALANCE, initialState: roundTrip(mid) });
    for (let i = 0; i < 50; i++) {
      player.engine.step();
      restored.step();
    }
    expect(restored.getState()).toEqual(player.state());
  });

  it('pracownik, który już wyszedł, nie narusza spójności w leaving', () => {
    const player = leavingPlayer();
    const state = player.state();
    const [gone] = state.world.movement.agents;
    if (!gone) throw new Error('brak postaci');
    const partial = {
      ...state,
      world: {
        ...state.world,
        movement: {
          ...state.world.movement,
          agents: state.world.movement.agents.filter((a) => a.id !== gone.id),
          reservations: Object.fromEntries(
            Object.entries(state.world.movement.reservations).filter(([, h]) => h !== gone.id),
          ),
        },
      },
    };
    expect(roundTrip(partial)).toEqual(partial);
  });

  it('workEnded z postacią w biurze — odrzucony', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.mission.phase = 'workEnded';
        s.mission.timeInDayMs = DAY_LENGTH_MS;
        s.world.movement = {
          step: 10,
          agents: [createAgent('employee-1', { x: 5, y: 6 })],
          reservations: {},
        };
      }),
      'Po pracy biuro jest puste',
    );
  });

  it('pracownik bez postaci w working — odrzucony', () => {
    const player = createPlayer();
    player.hire('frontend', 'junior');
    const state = player.state();
    const json = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      ...meta,
      state: {
        ...state,
        world: { ...state.world, movement: { step: 0, agents: [], reservations: {} } },
      },
    });
    expectInvalidState(json, 'Pracownik bez postaci w biurze');
  });

  it('licznik przejścia poza przyjściem i wyjściem — odrzucony', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.mission.transitSteps = 3;
      }),
      'Licznik przejścia',
    );
  });

  it('licznik przejścia od limitu wzwyż — odrzucony', () => {
    expectInvalidState(
      withJsonEdit((s) => {
        s.mission.phase = 'leaving';
        s.mission.timeInDayMs = DAY_LENGTH_MS;
        s.mission.transitSteps = 600;
      }),
      'Licznik przejścia',
    );
  });
});

describe('serializeSnapshot', () => {
  it('nie zapisuje stanu z funkcją ani obiektem spoza danych', () => {
    const initial = createInitialState(DEFAULT_BALANCE, 1);
    const broken = {
      ...initial,
      mission: { ...initial.mission, speed: (() => 1) as unknown as 0 },
    };

    const result = serializeSnapshot(broken, meta, context);

    expect(result.ok).toBe(false);
  });

  it('nie zapisuje stanu niespójnego (kolizja mebli)', () => {
    const initial = createInitialState(DEFAULT_BALANCE, 1);
    const first = initial.world.furniture['furniture-1' as FurnitureId];
    const second = initial.world.furniture['furniture-2' as FurnitureId];
    if (!first || !second) throw new Error('brak mebli');
    const broken: GameState = {
      ...initial,
      world: {
        ...initial.world,
        furniture: { ...initial.world.furniture, [second.id]: { ...second, origin: first.origin } },
      },
    };

    expect(serializeSnapshot(broken, meta, context)).toMatchObject({
      ok: false,
      error: { code: 'invalidState' },
    });
  });
});

describe('postacie z listy w zapisie', () => {
  it('kandydaci i zatrudnieni przetrwają zapis z ID postaci', () => {
    const engine = createEngine({
      config: DEFAULT_BALANCE,
      initialState: createInitialState(DEFAULT_BALANCE, 5),
    });
    const first = engine.getState().staff.candidates[0];
    if (first) engine.dispatch({ type: 'HireCandidate', candidateId: first.id });
    const state = engine.getState();
    expect(roundTrip(state)).toEqual(state);
  });

  it('odrzuca nieznaną postać, imię niezgodne z listą i tę samą postać dwa razy', () => {
    expectInvalidState(
      withJsonEdit((s) => (s.staff.candidates[0].personId = 'jan-nieznany')),
      'Postać jan-nieznany niezgodna z listą',
    );
    expectInvalidState(
      withJsonEdit((s) => (s.staff.candidates[0].name = 'Ktoś Inny')),
      'niezgodna z listą',
    );
    expectInvalidState(
      withJsonEdit((s) => (s.staff.candidates[1].personId = s.staff.candidates[0].personId)),
      'występuje dwa razy',
    );
    expectInvalidState(
      withJsonEdit((s) => {
        const { personId, name } = s.staff.candidates[0];
        s.staff.departures = [
          { employeeId: 'employee-1', personId, name, day: 1, reason: 'fired' },
        ];
        s.ids.employee = 1;
      }),
      'występuje dwa razy',
    );
  });
});

describe('roślina w zapisie', () => {
  it('kupiona roślina przetrwa zapis', () => {
    const engine = createEngine({
      config: DEFAULT_BALANCE,
      initialState: createInitialState(DEFAULT_BALANCE, 3),
    });
    expect(
      engine.dispatch({
        type: 'BuyFurniture',
        furnitureType: 'plant',
        origin: { x: 12, y: 12 },
        rotation: 0,
      }),
    ).toEqual({ ok: true });
    const state = engine.getState();
    expect(roundTrip(state)).toEqual(state);
  });
});

describe('prolog w zapisie', () => {
  it('stan każdego kroku prologu przetrwa zapis', () => {
    const player = createPlayer(DEFAULT_BALANCE, 5, createPrologueState(DEFAULT_BALANCE, 5));
    const seen = new Set<string>();
    const check = () => {
      const state = player.state();
      const step = state.prologue?.step ?? 'brak';
      if (seen.has(step)) return;
      seen.add(step);
      expect(roundTrip(state)).toEqual(state);
    };
    check();
    const first = player.acceptStarter();
    check();
    const owner = Object.values(player.state().staff.employees)[0]?.id as EmployeeId;
    player.assign(owner, first);
    check();
    player.runUntil((s) => s.contracts.projects[first]?.progress.frontend === 60 * POINT_SCALE);
    if (player.state().mission.phase === 'workEnded') {
      player.must({ type: 'SettleDay' });
      check();
      player.must({ type: 'StartNextDay' });
    }
    player.must({ type: 'DeliverProject', projectId: first });
    check();
    player.must({ type: 'SetSpeed', speed: 0 });
    player.buyDesk();
    check();
    player.hire('backend', 'mid');
    check();
    expect([...seen]).toEqual([
      'acceptFirst',
      'assignOwner',
      'deliverFirst',
      'buyDesk',
      'hireHelper',
      'acceptSecond',
    ]);
  });

  it('nieznany krok prologu jest odrzucany', () => {
    const json = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      ...meta,
      state: { ...createPrologueState(DEFAULT_BALANCE, 5), prologue: { step: 'tutorial' } },
    });
    expect(parseSnapshot(json, context)).toMatchObject({
      ok: false,
      error: { code: 'invalidState' },
    });
  });

  it('właściwa misja nadal wymaga pełnego rynku kandydatów', () => {
    const json = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      ...meta,
      state: { ...createPrologueState(DEFAULT_BALANCE, 5), prologue: null },
    });
    expect(parseSnapshot(json, context)).toMatchObject({
      ok: false,
      error: { code: 'invalidState' },
    });
  });
});
