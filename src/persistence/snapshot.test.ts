/* eslint-disable @typescript-eslint/no-explicit-any -- testy celowo psują surowy JSON zapisu */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { POINT_SCALE } from '../domain/contracts';
import type { FurnitureId } from '../domain/furniture';
import { createAgent } from '../domain/movement';
import { createInitialState, type GameState } from '../domain/state';
import { createEngine } from '../simulation/engine';
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
  for (let i = 0; i < DAY_LENGTH_MS / DEFAULT_BALANCE.simulation.stepMs; i++) engine.step();
  states.push(engine.getState());
  engine.dispatch({ type: 'SettleDay' });
  states.push(engine.getState());
  engine.dispatch({ type: 'StartNextDay' });
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
    for (let i = 0; i < 25; i++) engine.step();
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
    expectInvalidState(withAgents([{ ...base, cell: { x: 3, y: 2 } }]), 'na przeszkodzie');
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
