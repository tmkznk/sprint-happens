import { describe, expect, it } from 'vitest';
import { peopleCount, projectsCount } from './plural';

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

describe('odmiana liczby projektów', () => {
  it('1 projekt, 2–4 projekty, 5+ projektów, 12–14 projektów, 22 projekty', () => {
    expect([1, 2, 4, 5, 6, 12, 14, 22].map(projectsCount)).toEqual([
      '1 projekt',
      '2 projekty',
      '4 projekty',
      '5 projektów',
      '6 projektów',
      '12 projektów',
      '14 projektów',
      '22 projekty',
    ]);
  });
});
