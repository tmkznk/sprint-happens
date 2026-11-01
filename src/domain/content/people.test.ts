import { describe, expect, it } from 'vitest';
import { SENIORITIES, SPECIALIZATIONS } from '../employees';
import { PEOPLE, PROLOGUE_OWNER, personById } from './people';

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

  it('pali dokładnie 16 z 63 postaci rynku, po 2–8 papierosów', () => {
    const smokers = PEOPLE.filter((p) => p.cigarettesPerDay > 0);
    expect(PEOPLE).toHaveLength(63);
    expect(smokers).toHaveLength(16);
    for (const p of smokers) expect(p.cigarettesPerDay).toBeGreaterThanOrEqual(2);
    for (const p of smokers) expect(p.cigarettesPerDay).toBeLessThanOrEqual(8);
    expect(PROLOGUE_OWNER.cigarettesPerDay).toBe(0);
  });

  it('palacze rozłożeni równo: każda specjalizacja ma 2–3, każde seniority 5–6', () => {
    const smokers = PEOPLE.filter((p) => p.cigarettesPerDay > 0);
    for (const specialization of SPECIALIZATIONS) {
      const n = smokers.filter((p) => p.specialization === specialization).length;
      expect(n, specialization).toBeGreaterThanOrEqual(2);
      expect(n, specialization).toBeLessThanOrEqual(3);
    }
    for (const seniority of SENIORITIES) {
      const n = smokers.filter((p) => p.seniority === seniority).length;
      expect(n, seniority).toBeGreaterThanOrEqual(5);
      expect(n, seniority).toBeLessThanOrEqual(6);
    }
  });

  it('każda wartość 2…8 występuje co najmniej dwa razy', () => {
    for (let value = 2; value <= 8; value++) {
      const n = PEOPLE.filter((p) => p.cigarettesPerDay === value).length;
      expect(n, `${value}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('bio nie zdradza palenia', () => {
    for (const p of PEOPLE)
      expect(p.bio, p.id).not.toMatch(/(?<!\p{L})(papieros|pali|palacz|fajk|dym)/iu);
  });
});
