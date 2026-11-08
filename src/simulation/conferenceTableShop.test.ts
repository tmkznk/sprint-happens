import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { testState } from '../test/engineFixture';
import { wonChapterOne } from '../test/chapterFixture';
import { beginChapterTwo } from './chapters';
import { createEngine } from './engine';

// SH-052: stół konferencyjny w sklepie tylko w rozdziale 2.
describe('zakup stołu konferencyjnego', () => {
  it('rozdział 1 — niedostępny', () => {
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: testState() });
    const before = engine.getState();
    expect(
      engine.dispatch({
        type: 'BuyFurniture',
        furnitureType: 'conferenceTable',
        origin: { x: 8, y: 9 },
        rotation: 0,
      }),
    ).toEqual({ ok: false, rejection: { code: 'notAvailable' } });
    expect(engine.getState()).toBe(before);
  });

  it('rozdział 2 — w salce, za 4 000 zł', () => {
    const start = beginChapterTwo(wonChapterOne(), DEFAULT_BALANCE);
    if (!start.ok) throw new Error(start.code);
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: start.state });
    const cash = engine.getState().finance.cash;
    expect(
      engine.dispatch({
        type: 'BuyFurniture',
        furnitureType: 'conferenceTable',
        origin: { x: 9, y: 1 },
        rotation: 90,
      }),
    ).toEqual({ ok: true });
    expect(engine.getState().finance.cash).toBe(cash - 4_000);
  });
});
