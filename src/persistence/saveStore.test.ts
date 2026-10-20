import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createIndexedDbSaveStore, createMemorySaveStore, revisionOf } from './saveStore';

const save = (revision: number) => JSON.stringify({ revision, state: `stan-${revision}` });

describe.each([
  ['IndexedDB', () => createIndexedDbSaveStore(new IDBFactory())],
  ['pamięć', () => createMemorySaveStore().store],
])('magazyn zapisu: %s', (_, create) => {
  it('pusty magazyn nie ma zapisów', async () => {
    expect(await create().read()).toEqual({ current: null, previous: null });
  });

  it('kolejny zapis przenosi bieżący do kopii awaryjnej (B6)', async () => {
    const store = create();
    expect(await store.write(save(1), null)).toEqual({ ok: true });
    expect(await store.write(save(2), 1)).toEqual({ ok: true });

    expect(await store.read()).toEqual({ current: save(2), previous: save(1) });
  });

  it('odrzuca zapis przy niezgodnej rewizji i nie zmienia żadnej kopii', async () => {
    const store = create();
    await store.write(save(1), null);
    await store.write(save(2), 1);

    const result = await store.write(save(2), 1);

    expect(result).toMatchObject({ ok: false, reason: 'conflict' });
    expect(await store.read()).toEqual({ current: save(2), previous: save(1) });
  });

  it('pierwszy zapis wymaga braku istniejącego zapisu', async () => {
    const store = create();
    await store.write(save(5), null);

    expect(await store.write(save(1), null)).toMatchObject({ ok: false, reason: 'conflict' });
  });
});

describe('revisionOf', () => {
  it('odczytuje rewizję lub zwraca null', () => {
    expect(revisionOf(save(3))).toBe(3);
    expect(revisionOf(null)).toBeNull();
    expect(revisionOf('{zepsute')).toBeNull();
  });
});
