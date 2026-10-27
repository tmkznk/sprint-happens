import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { PEOPLE } from '../domain/content/people';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import fixture from './fixtures/save-older-format.json?raw';
import saveV1 from './fixtures/save-v1.json?raw';
import type { ValidationContext } from './schema';
import {
  MIGRATIONS,
  parseSnapshot,
  SCHEMA_VERSION,
  type FormatOptions,
  type Migration,
} from './snapshot';

const context: ValidationContext = { config: DEFAULT_BALANCE, layout: OFFICE_LAYOUT };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dowolny kształt starszego zapisu
type Loose = Record<string, any>;

// Mechanizm migracji: fixture to zapis deweloperski w wersji 1 sprzed zdarzeń (SH-031)
// i zadowolenia (SH-019), a test udaje format 2. Migracja testowa 1 → 2:
// dodaje stan zdarzeń, historię odejść, zadowolenie, postacie z listy (imiona dawniej losowane)
// i pusty stan prologu. Celowo modyfikuje wejście — sprawdzamy,
// że dostaje kopię, a nie oryginał.
const toV2: Migration = (input) => {
  const state = input as Loose;
  state.prologue = null;
  state.events = {
    scheduledAtMs: null,
    pending: null,
    lastSeenDay: {},
    meetingUntilMs: null,
    coffeeBrokenDay: null,
  };
  state.staff.departures = [];
  for (const employee of Object.values(state.staff.employees) as Loose[]) {
    employee.satisfaction = 70 * 60_000;
    employee.badConditionsMs = 0;
    employee.lowSatisfactionMs = 0;
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
});
