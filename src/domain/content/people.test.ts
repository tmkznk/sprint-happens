import { describe, expect, it } from 'vitest';
import { SENIORITIES, SPECIALIZATIONS } from '../employees';
import { PEOPLE, personById } from './people';

describe('lista postaci', () => {
  it('po trzy osoby na każdą parę specjalizacja × seniority', () => {
    for (const specialization of SPECIALIZATIONS) {
      for (const seniority of SENIORITIES) {
        const pool = PEOPLE.filter(
          (p) => p.specialization === specialization && p.seniority === seniority,
        );
        expect(pool, `${specialization}/${seniority}`).toHaveLength(3);
      }
    }
  });

  it('ID, imiona i opisy są unikalne; ID to bezpieczna nazwa pliku awatara', () => {
    expect(new Set(PEOPLE.map((p) => p.id)).size).toBe(PEOPLE.length);
    expect(new Set(PEOPLE.map((p) => p.name)).size).toBe(PEOPLE.length);
    expect(new Set(PEOPLE.map((p) => p.bio)).size).toBe(PEOPLE.length);
    for (const person of PEOPLE) {
      expect(person.id).toMatch(/^[a-z]+(-[a-z]+)+$/);
      expect(personById(person.id)).toBe(person);
    }
  });
});
