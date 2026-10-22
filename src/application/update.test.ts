import { describe, expect, it, vi } from 'vitest';
import { testEngine } from '../test/engineFixture';
import { saveAndUpdate } from './update';

describe('„Zapisz i zaktualizuj” (SH-041, PWA-T02)', () => {
  it('pauzuje, zapisuje i dopiero potem aktywuje nową wersję', async () => {
    const engine = testEngine();
    engine.dispatch({ type: 'SetSpeed', speed: 2 });
    const order: string[] = [];
    const flush = vi.fn(() => {
      order.push(`zapis przy tempie ${engine.getState().mission.speed}`);
      return Promise.resolve(true);
    });
    const apply = vi.fn(() => {
      order.push('aktualizacja');
      return true;
    });
    expect(await saveAndUpdate(engine, { flush }, apply)).toBe('updating');
    expect(order).toEqual(['zapis przy tempie 0', 'aktualizacja']);
  });

  it('nieudany zapis blokuje aktualizację', async () => {
    const apply = vi.fn(() => true);
    const result = await saveAndUpdate(
      testEngine(),
      { flush: () => Promise.resolve(false) },
      apply,
    );
    expect(result).toBe('saveFailed');
    expect(apply).not.toHaveBeenCalled();
  });

  it('brak oczekującej wersji — bez przeładowania', async () => {
    const result = await saveAndUpdate(
      testEngine(),
      { flush: () => Promise.resolve(true) },
      () => false,
    );
    expect(result).toBe('noUpdate');
  });
});
