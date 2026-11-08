import { describe, expect, it } from 'vitest';
import { EVENT_TEMPLATES } from './events';
import { RETRO_CARDS } from './retroCards';

// SH-057: treści rozdziału 2 zaakceptowane przez właściciela 2026-11-08.
describe('treści rozdziału 2 (SH-057)', () => {
  it('11 kart retro: unikalne ID, plus i minus, efekt z korzyścią i kosztem', () => {
    expect(RETRO_CARDS).toHaveLength(11);
    expect(new Set(RETRO_CARDS.map((c) => c.id)).size).toBe(11);
    for (const card of RETRO_CARDS) {
      expect(card.id).toMatch(/^[a-z][a-zA-Z]*$/);
      expect(card.plus.length).toBeGreaterThan(0);
      expect(card.minus.length).toBeGreaterThan(0);
      expect(Object.keys(card.effect).length, card.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('7 zdarzeń agile tylko w rozdziale 2', () => {
    const agile = EVENT_TEMPLATES.filter((t) => t.chapters?.includes(2));
    expect(agile.map((t) => t.id).sort()).toEqual(
      [
        'agile-long-daily',
        'agile-sold-deadline',
        'agile-points-kpi',
        'agile-foosball',
        'agile-flat-structure',
        'agile-new-framework',
        'agile-ceremony-reports',
      ].sort(),
    );
    for (const template of agile) {
      expect(template.chapters).toEqual([2]);
      expect(template.options.length).toBeGreaterThanOrEqual(2);
    }
  });
});
