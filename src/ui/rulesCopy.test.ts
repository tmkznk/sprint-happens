import { describe, expect, it } from 'vitest';
import { CHAPTER_TWO_RULES, RULES, rulesSections } from './rulesCopy';

// SH-059: sekcja rozdziału 2 w „Zasadach gry” — widoczna razem z rozdziałem 2 (flaga).
describe('Zasady gry — rozdział 2', () => {
  it('sekcja tylko przy włączonym rozdziale 2', () => {
    expect(rulesSections(false)).toEqual(RULES);
    expect(rulesSections(true)).toEqual([...RULES, CHAPTER_TWO_RULES]);
  });

  it('sześć pytań, bez liczb balansu (poza stałą godziną daily)', () => {
    expect(CHAPTER_TWO_RULES.questions).toHaveLength(6);
    const text = CHAPTER_TWO_RULES.questions
      .flatMap((q) => q.answer)
      .join(' ')
      .replace('10:00', '');
    expect(text).not.toMatch(/\d/);
  });
});
