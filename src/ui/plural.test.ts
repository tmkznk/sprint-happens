import { describe, expect, it } from 'vitest';
import { peopleCount } from './plural';

describe('odmiana liczby osób', () => {
  it('1 osoba, 2–4 osoby, 5+ osób, 12–14 osób, 22 osoby', () => {
    expect([0, 1, 2, 4, 5, 12, 14, 22, 25].map(peopleCount)).toEqual([
      '0 osób',
      '1 osoba',
      '2 osoby',
      '4 osoby',
      '5 osób',
      '12 osób',
      '14 osób',
      '22 osoby',
      '25 osób',
    ]);
  });
});
