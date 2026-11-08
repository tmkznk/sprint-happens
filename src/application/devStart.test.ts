import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { parseSnapshot, serializeSnapshot } from '../persistence/snapshot';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import { chapterTwoDevState } from './devStart';

// Wersja deweloperska: start od razu w rozdziale 2 (do testów i balansu właściciela).
describe('start rozdziału 2 w wersji deweloperskiej', () => {
  it('rozdział 2 jak po wygranym rozdziale 1: progi rozdziału 1, meble w magazynie, 9:00, pauza', () => {
    const state = chapterTwoDevState(DEFAULT_BALANCE, 7);
    const won = DEFAULT_BALANCE.mission.victory[1];
    expect(state.mission).toMatchObject({
      chapter: 2,
      status: 'active',
      phase: 'working',
      speed: 0,
    });
    expect(state.finance.cash).toBe(won.cash);
    expect(state.mission.reputation).toBe(won.reputation);
    expect(state.world.furniture).toEqual({});
    expect(state.world.storage).toEqual({ desk: 2, sofa: 1, coffeeMachine: 1 });
    expect(state.scrum).not.toBeNull();
    expect(state.staff.candidates.some((c) => c.specialization === 'scrumMaster')).toBe(true);
  });

  it('przechodzi walidację zapisu', () => {
    const state = chapterTwoDevState(DEFAULT_BALANCE, 7);
    const context = { config: DEFAULT_BALANCE, layout: OFFICE_LAYOUT };
    const json = serializeSnapshot(
      state,
      { gameBuildVersion: 'dev', revision: 0, savedAt: '2026-11-08T12:00:00.000Z' },
      context,
    );
    if (!json.ok) throw new Error(json.error.issues.join('\n'));
    expect(parseSnapshot(json.json, context).ok).toBe(true);
  });
});
