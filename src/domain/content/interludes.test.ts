import { describe, expect, it } from 'vitest';
import { INTERLUDES, type InterludeId } from './interludes';

describe('przerywniki fabularne (SH-048)', () => {
  it.each<InterludeId>(['beforePrologue', 'afterPrologue', 'afterChapterOne'])(
    '%s ma tytuł, tekst i przycisk',
    (id) => {
      const interlude = INTERLUDES[id];
      expect(interlude.kicker).toMatch(/^(Prolog|Rozdział \d)$/);
      expect(interlude.title).toMatch(/^„.+”$/);
      expect(interlude.subtitle.length).toBeGreaterThan(0);
      expect(interlude.paragraphs.length).toBeGreaterThan(0);
      for (const paragraph of interlude.paragraphs) expect(paragraph.trim()).toBe(paragraph);
      expect(interlude.button.length).toBeGreaterThan(0);
    },
  );
});
