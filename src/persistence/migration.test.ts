import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { createPlayer } from '../test/player';
import { DAY_LENGTH_MS } from '../simulation/time';
import { PEOPLE } from '../domain/content/people';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import fixture from './fixtures/save-older-format.json?raw';
import saveV1 from './fixtures/save-v1.json?raw';
import saveV4 from './fixtures/save-v4.json?raw';
import saveV5 from './fixtures/save-v5.json?raw';
import saveV6 from './fixtures/save-v6.json?raw';
import saveV7 from './fixtures/save-v7.json?raw';
import type { ValidationContext } from './schema';
import {
  MIGRATIONS,
  parseSnapshot,
  SCHEMA_VERSION,
  serializeSnapshot,
  type FormatOptions,
  type Migration,
} from './snapshot';

const context: ValidationContext = { config: DEFAULT_BALANCE, layout: OFFICE_LAYOUT };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dowolny kształt starszego zapisu
type Loose = Record<string, any>;

// Mechanizm migracji: fixture to zapis deweloperski w wersji 1 sprzed zdarzeń (SH-031)
// i zadowolenia (SH-019), a test udaje format 2. Migracja testowa 1 → 2:
// dodaje stan zdarzeń, historię odejść, zadowolenie, postacie z listy (imiona dawniej losowane)
// i pusty stan prologu, licznik przejścia, kolejkę do wejścia oraz rozdział i magazyn (bieżący kształt stanu). Celowo modyfikuje wejście — sprawdzamy,
// że dostaje kopię, a nie oryginał.
const toV2: Migration = (input) => {
  const state = input as Loose;
  state.prologue = null;
  state.mission.transitSteps = 0;
  state.mission.chapter = 1;
  state.contracts.chapterDeliveredCount = state.contracts.deliveredCount;
  state.world.storage = {};
  state.scrum = null;
  state.events = {
    scheduledAtMs: null,
    pending: null,
    lastSeenDay: {},
    meetingUntilMs: null,
    coffeeBrokenDay: null,
  };
  state.staff.departures = [];
  state.staff.entryQueue = [];
  for (const employee of Object.values(state.staff.employees) as Loose[]) {
    employee.satisfaction = 70 * 60_000;
    employee.badConditionsMs = 0;
    employee.lowSatisfactionMs = 0;
    employee.breakHold = false;
    employee.orderedRest = false;
    employee.cigarettesHandled = 0;
  }
  const used = new Set<string>();
  const people = [
    ...(Object.values(state.staff.employees) as Loose[]),
    ...(state.staff.candidates as Loose[]),
  ];
  for (const entry of people) {
    const person = PEOPLE.find(
      (p) =>
        p.specialization === entry.specialization &&
        p.seniority === entry.seniority &&
        !used.has(p.id),
    );
    if (!person) throw new Error('brak postaci');
    used.add(person.id);
    entry.personId = person.id;
    entry.name = person.name;
  }
  return state;
};

const format = (migrations: FormatOptions['migrations']): FormatOptions => ({
  version: 2,
  migrations,
});

describe('migracje zapisu (SH-039, T:SAVE-T05)', () => {
  it('fixture starszego formatu nie wczytuje się bez migracji', () => {
    const result = parseSnapshot(fixture, context, format({}));
    expect(result).toMatchObject({ ok: false, error: { code: 'needsMigration' } });
  });

  it('migracja działa na kopii: wynik przechodzi walidację, tekst oryginału bez zmian', () => {
    const original = fixture;
    const result = parseSnapshot(fixture, context, format({ 1: toV2 }));
    if (!result.ok) throw new Error(result.error.issues.join('\n'));

    expect(result.migratedFrom).toBe(1);
    expect(result.envelope.schemaVersion).toBe(2);
    expect(result.envelope.revision).toBe(3);
    expect(result.envelope.state.events.pending).toBeNull();
    expect(Object.values(result.envelope.state.staff.employees)[0]?.satisfaction).toBe(70 * 60_000);
    expect(fixture).toBe(original);
    expect((JSON.parse(fixture) as Loose).state.events).toBeUndefined();
  });

  it('błąd migracji albo niepoprawny wynik → migrationFailed, bez wyjątku', () => {
    const throwing: Migration = () => {
      throw new Error('brak danych');
    };
    const incomplete: Migration = (input) => input;
    expect(parseSnapshot(fixture, context, format({ 1: throwing }))).toMatchObject({
      ok: false,
      error: { code: 'migrationFailed' },
    });
    expect(parseSnapshot(fixture, context, format({ 1: incomplete }))).toMatchObject({
      ok: false,
      error: { code: 'migrationFailed' },
    });
  });

  it('bieżący zapis nie jest migrowany; nowszy format jest odrzucany', () => {
    const current = JSON.stringify({ ...JSON.parse(fixture), schemaVersion: 3 });
    expect(parseSnapshot(current, context, format({ 1: toV2 }))).toMatchObject({
      ok: false,
      error: { code: 'newerVersion' },
    });
  });

  it('zapis wersji 1 (przed prologiem) wczytuje się jako właściwa misja', () => {
    const result = parseSnapshot(saveV1, context);
    if (!result.ok) throw new Error(result.error.issues.join('\n'));
    expect(result.migratedFrom).toBe(1);
    expect(result.envelope.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.envelope.state.prologue).toBeNull();
    expect(Object.keys(result.envelope.state.staff.employees)).toHaveLength(2);
  });

  it('łańcuch migracji obejmuje każdą wersję od 1 do bieżącej', () => {
    for (let version = 1; version < SCHEMA_VERSION; version++) {
      expect(MIGRATIONS[version]).toBeTypeOf('function');
    }
  });

  // Zapis wersji 2 budujemy jako surowy obiekt: bieżący stan w JSON bez pól wersji 3
  // (`mission.transitSteps`, `staff.entryQueue`) i 4 (`breakHold`, `orderedRest`) oraz z wersją
  // 2 w kopercie.
  function v2Text(prepare: (state: Loose) => void): string {
    const player = createPlayer();
    player.hire('frontend', 'junior');
    const serialized = serializeSnapshot(
      player.state(),
      { gameBuildVersion: '0.0.0', revision: 4, savedAt: '2026-10-29T12:00:00.000Z' },
      context,
    );
    if (!serialized.ok) throw new Error(serialized.error.issues.join('\n'));
    const envelope = JSON.parse(serialized.json) as Loose;
    envelope.schemaVersion = 2;
    delete envelope.state.mission.transitSteps;
    delete envelope.state.staff.entryQueue;
    for (const employee of Object.values(envelope.state.staff.employees) as Loose[]) {
      delete employee.breakHold;
      delete employee.orderedRest;
    }
    prepare(envelope.state);
    return JSON.stringify(envelope);
  }

  it('zapis wersji 2 w workEnded wczytuje się z pustym biurem', () => {
    const text = v2Text((state) => {
      // Stary zapis po 17:00: wszyscy nadal w biurze.
      state.mission.phase = 'workEnded';
      state.mission.timeInDayMs = DAY_LENGTH_MS;
      state.world.movement.reservations = { 'x:1,y:1': 'employee-1' };
      expect(state.world.movement.agents.length).toBeGreaterThan(0);
    });
    const original = text;
    const result = parseSnapshot(text, context);
    if (!result.ok) throw new Error(result.error.issues.join('\n'));

    expect(result.migratedFrom).toBe(2);
    expect(result.envelope.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.envelope.state.world.movement.agents).toEqual([]);
    expect(result.envelope.state.world.movement.reservations).toEqual({});
    expect(result.envelope.state.mission.transitSteps).toBe(0);
    expect(result.envelope.state.staff.entryQueue).toEqual([]);
    expect(text).toBe(original);
    expect((JSON.parse(text) as Loose).state.world.movement.agents.length).toBeGreaterThan(0);
  });

  it('zapis wersji 2 w working zachowuje pozycje postaci', () => {
    const text = v2Text(() => {});
    const before = (JSON.parse(text) as Loose).state.world.movement.agents;
    const result = parseSnapshot(text, context);
    if (!result.ok) throw new Error(result.error.issues.join('\n'));

    expect(result.migratedFrom).toBe(2);
    expect(result.envelope.state.mission.phase).toBe('working');
    expect(result.envelope.state.world.movement.agents).toEqual(before);
    expect(result.envelope.state.world.movement.agents.length).toBeGreaterThan(0);
    expect(result.envelope.state.mission.transitSteps).toBe(0);
    expect(result.envelope.state.staff.entryQueue).toEqual([]);
    expect((JSON.parse(text) as Loose).state.mission.transitSteps).toBeUndefined();
  });

  it('zapis wersji 3 dostaje breakHold i orderedRest false', () => {
    const player = createPlayer();
    player.hire('frontend', 'junior');
    const serialized = serializeSnapshot(
      player.state(),
      { gameBuildVersion: '0.0.0', revision: 5, savedAt: '2026-10-29T12:00:00.000Z' },
      context,
    );
    if (!serialized.ok) throw new Error(serialized.error.issues.join('\n'));
    const envelope = JSON.parse(serialized.json) as Loose;
    envelope.schemaVersion = 3;
    const employees = Object.values(envelope.state.staff.employees) as Loose[];
    expect(employees.length).toBeGreaterThan(0);
    for (const employee of employees) {
      delete employee.breakHold;
      delete employee.orderedRest;
    }
    const text = JSON.stringify(envelope);
    const result = parseSnapshot(text, context);
    if (!result.ok) throw new Error(result.error.issues.join('\n'));

    expect(result.migratedFrom).toBe(3);
    expect(result.envelope.schemaVersion).toBe(SCHEMA_VERSION);
    const migrated = Object.values(result.envelope.state.staff.employees);
    expect(migrated).toHaveLength(employees.length);
    for (const employee of migrated) {
      expect(employee).toMatchObject({ breakHold: false, orderedRest: false });
    }
    expect(
      (Object.values((JSON.parse(text) as Loose).state.staff.employees)[0] as Loose).breakHold,
    ).toBeUndefined();
  });

  it('migracja v4 → v5 ustawia cigarettesHandled = 0, oryginał nietknięty', () => {
    const original = saveV4;
    const before = JSON.parse(saveV4) as Loose;
    expect(before.schemaVersion).toBe(4);
    const result = parseSnapshot(saveV4, context);
    if (!result.ok) throw new Error(result.error.issues.join('\n'));

    expect(result.migratedFrom).toBe(4);
    expect(result.envelope.schemaVersion).toBe(SCHEMA_VERSION);
    const migrated = Object.values(result.envelope.state.staff.employees);
    expect(migrated.length).toBeGreaterThan(0);
    for (const employee of migrated) expect(employee.cigarettesHandled).toBe(0);
    expect(saveV4).toBe(original);
    const first = Object.values(before.state.staff.employees)[0] as Loose;
    expect(first.cigarettesHandled).toBeUndefined();
  });
});

describe('v5 → v6: rozdziały kampanii', () => {
  it('zapis z wersji 5 wczytuje się jako rozdział 1 z pustym magazynem', () => {
    const original = saveV5;
    const before = JSON.parse(saveV5) as Loose;
    expect(before.schemaVersion).toBe(5);
    const result = parseSnapshot(saveV5, context);
    if (!result.ok) throw new Error(result.error.issues.join('\n'));

    expect(result.migratedFrom).toBe(5);
    const { state } = result.envelope;
    expect(state.mission.chapter).toBe(1);
    expect(state.contracts.chapterDeliveredCount).toBe(state.contracts.deliveredCount);
    expect(state.world.storage).toEqual({});
    expect(Object.keys(state.staff.employees)).toHaveLength(2);
    expect(saveV5).toBe(original);
  });
});

describe('v6 → v7: Scrum', () => {
  it('zapis rozdziału 2 z wersji 6 dostaje pusty stan Scruma', () => {
    const result = parseSnapshot(saveV6, context);
    if (!result.ok) throw new Error(result.error.issues.join('\n'));
    expect(result.migratedFrom).toBe(6);
    expect(result.envelope.state.mission.chapter).toBe(2);
    expect(result.envelope.state.scrum).toMatchObject({
      sprint: null,
      cards: [],
      pendingGoal: false,
    });
  });

  it('zapis rozdziału 1 (wersja 5 → 7) nie ma stanu Scruma', () => {
    const result = parseSnapshot(saveV5, context);
    if (!result.ok) throw new Error(result.error.issues.join('\n'));
    expect(result.envelope.state.scrum).toBeNull();
  });
});

describe('v7 → v8: znacznik ceremonii', () => {
  it('zapis z trwającym sprintem z wersji 7 wczytuje się bez ostatniej ceremonii', () => {
    const result = parseSnapshot(saveV7, context);
    if (!result.ok) throw new Error(result.error.issues.join('\n'));
    expect(result.migratedFrom).toBe(7);
    expect(result.envelope.state.scrum?.sprint?.number).toBe(1);
    expect(result.envelope.state.scrum?.lastCeremony).toBeNull();
  });
});
