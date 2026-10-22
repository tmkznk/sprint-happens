// T:SAVE-T01, SAVE-T06 (decyzja SH-004 B6): jeden slot misji i poprzednia poprawna kopia.
// Magazyn operuje na tekście zapisu; walidacja treści należy do snapshot.ts.

export type StoredSaves = { current: string | null; previous: string | null };

export type WriteResult =
  | { ok: true }
  // Ktoś inny zapisał w międzyczasie (np. druga karta) — nie nadpisujemy jego postępu.
  | { ok: false; reason: 'conflict'; message: string }
  | { ok: false; reason: 'storageError'; message: string };

export type SaveStore = {
  read(): Promise<StoredSaves>;
  // W jednej transakcji: sprawdzenie rewizji bieżącego zapisu, previous ← current, current ← json.
  // `expectedRevision` to rewizja ostatniego zapisu znanego wywołującemu (null — brak zapisu).
  // `keepPrevious` — bieżący zapis jest uszkodzony lub zastępowany po odzyskaniu: nie przesuwamy
  // go do kopii, aby nie zniszczyć ostatniej poprawnej kopii awaryjnej (SAVE-T01, SH-039).
  write(
    json: string,
    expectedRevision: number | null,
    options?: { keepPrevious?: boolean },
  ): Promise<WriteResult>;
};

// Rewizja bez pełnej walidacji — wystarczy do kontroli konfliktu zapisu.
export function revisionOf(json: string | null): number | null {
  if (json === null) return null;
  try {
    const revision: unknown = (JSON.parse(json) as { revision?: unknown }).revision;
    return typeof revision === 'number' ? revision : null;
  } catch {
    return null;
  }
}

const DB_NAME = 'sprint-happens';
const STORE_NAME = 'saves';
const CURRENT = 'current';
const PREVIOUS = 'previous';

export function createIndexedDbSaveStore(factory: IDBFactory = indexedDB): SaveStore {
  let database: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Nie można otworzyć IndexedDB'));
    }).catch((error: unknown) => {
      // Nieudane otwarcie nie jest zapamiętywane — kolejna operacja spróbuje ponownie.
      database = null;
      throw error;
    });
    return database;
  }

  return {
    async read() {
      const db = await open();
      return new Promise<StoredSaves>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const current = store.get(CURRENT);
        const previous = store.get(PREVIOUS);
        transaction.oncomplete = () =>
          resolve({ current: asText(current.result), previous: asText(previous.result) });
        transaction.onerror = () => reject(transaction.error ?? new Error('Błąd odczytu zapisu'));
      });
    },

    async write(json, expectedRevision, options) {
      let db: IDBDatabase;
      try {
        db = await open();
      } catch (error) {
        return storageError(error);
      }
      return new Promise<WriteResult>((resolve) => {
        let conflict: WriteResult | null = null;
        let transaction: IDBTransaction;
        try {
          transaction = db.transaction(STORE_NAME, 'readwrite');
        } catch (error) {
          resolve(storageError(error));
          return;
        }
        const store = transaction.objectStore(STORE_NAME);
        const currentRequest = store.get(CURRENT);
        currentRequest.onsuccess = () => {
          const current = asText(currentRequest.result);
          const stored = revisionOf(current);
          if (stored !== expectedRevision) {
            conflict = {
              ok: false,
              reason: 'conflict',
              message: `Zapis ma rewizję ${String(stored)}, oczekiwano ${String(expectedRevision)}`,
            };
            transaction.abort();
            return;
          }
          if (current !== null && !options?.keepPrevious) store.put(current, PREVIOUS);
          store.put(json, CURRENT);
        };
        transaction.oncomplete = () => resolve({ ok: true });
        transaction.onabort = () => resolve(conflict ?? storageError(transaction.error));
      });
    },
  };
}

// Magazyn w pamięci — testy i wstrzykiwanie błędów zapisu.
export function createMemorySaveStore(initial: StoredSaves = { current: null, previous: null }) {
  const saves: StoredSaves = { ...initial };
  let failNext: string | null = null;
  const store: SaveStore = {
    read: () => Promise.resolve({ ...saves }),
    write(json, expectedRevision, options) {
      if (failNext !== null) {
        const message = failNext;
        failNext = null;
        return Promise.resolve({ ok: false, reason: 'storageError', message });
      }
      const stored = revisionOf(saves.current);
      if (stored !== expectedRevision) {
        return Promise.resolve({
          ok: false,
          reason: 'conflict',
          message: `Zapis ma rewizję ${String(stored)}, oczekiwano ${String(expectedRevision)}`,
        });
      }
      if (!options?.keepPrevious) saves.previous = saves.current;
      saves.current = json;
      return Promise.resolve({ ok: true });
    },
  };
  return {
    store,
    saves,
    failNextWrite(message: string) {
      failNext = message;
    },
  };
}

function asText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function storageError(error: unknown): WriteResult {
  const message = error instanceof Error ? error.message : 'Nieznany błąd magazynu';
  return { ok: false, reason: 'storageError', message };
}
