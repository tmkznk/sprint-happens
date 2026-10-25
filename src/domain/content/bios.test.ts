import { describe, expect, it } from 'vitest';
import { FIRST_NAMES, LAST_NAMES, SENIORITIES, SPECIALIZATIONS } from '../employees';
import { BIOS, bioFor } from './bios';

describe('opisy pracowników', () => {
  it('każda specjalizacja i poziom ma co najmniej dwa różne opisy', () => {
    for (const specialization of SPECIALIZATIONS) {
      for (const seniority of SENIORITIES) {
        const variants = BIOS[specialization][seniority];
        expect(variants.length).toBeGreaterThanOrEqual(2);
        expect(new Set(variants).size).toBe(variants.length);
      }
    }
  });

  it('opis jest stały dla osoby i pochodzi z puli jej specjalizacji i poziomu', () => {
    const person = { name: 'Ada Bugajska', specialization: 'qa', seniority: 'mid' } as const;
    expect(bioFor(person)).toBe(bioFor({ ...person }));
    expect(BIOS.qa.mid).toContain(bioFor(person));
  });

  it('różne imiona trafiają w różne warianty', () => {
    const used = new Set(
      FIRST_NAMES.flatMap((first) =>
        LAST_NAMES.map((last) =>
          bioFor({ name: `${first} ${last}`, specialization: 'backend', seniority: 'senior' }),
        ),
      ),
    );
    expect(used.size).toBe(BIOS.backend.senior.length);
  });
});
