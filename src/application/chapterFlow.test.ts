import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { ValidationContext } from '../persistence/schema';
import { createMemorySaveStore } from '../persistence/saveStore';
import { wonChapterOne } from '../test/chapterFixture';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import { loadChapterStart, prepareChapterTwo } from './chapterFlow';

const context: ValidationContext = { config: DEFAULT_BALANCE, layout: OFFICE_LAYOUT };
const NOW = '2026-11-08T12:00:00.000Z';

describe('przejście do rozdziału 2 w aplikacji (SH-049)', () => {
  it('zwycięski rozdział 1 daje stan rozdziału 2 i kopię startu, która wczytuje się do tego samego stanu', async () => {
    const prepared = prepareChapterTwo(wonChapterOne(), context, '1.0.0', NOW);
    if (!prepared.ok) throw new Error(prepared.reason);
    expect(prepared.state.mission.chapter).toBe(2);

    const { store } = createMemorySaveStore();
    await store.writeChapterStart(prepared.chapterStartJson);
    expect(await loadChapterStart(store, context)).toEqual(prepared.state);
  });

  it('misja w toku — przejście niedozwolone', () => {
    const won = wonChapterOne();
    const active = { ...won, mission: { ...won.mission, status: 'active' as const } };
    expect(prepareChapterTwo(active, context, '1.0.0', NOW)).toEqual({
      ok: false,
      reason: 'notAllowed',
    });
  });

  it('brak albo uszkodzona kopia startu — null', async () => {
    const { store } = createMemorySaveStore();
    expect(await loadChapterStart(store, context)).toBeNull();
    await store.writeChapterStart('{nie-json');
    expect(await loadChapterStart(store, context)).toBeNull();
  });
});
