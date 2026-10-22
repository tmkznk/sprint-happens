// F:PWA-01, T:PWA-T01, PWA-T04: czysta logika pamięci podręcznej service workera (testowalna
// bez przeglądarki). Jedna wersja = jeden komplet zasobów w jednym cache — bez mieszania wydań.

export const CACHE_PREFIX = 'sprint-happens-';

export function cacheName(version: string): string {
  return `${CACHE_PREFIX}${version}`;
}

// Ścieżki zasobów z buildu → adresy względem zakresu service workera (np. `assets/a.js`).
// Strona startowa jest dostępna pod `./` i `index.html`.
export function precacheUrls(files: readonly string[]): string[] {
  const urls = new Set<string>(['./']);
  for (const file of files) {
    if (file === 'sw.js' || file.endsWith('.map')) continue;
    urls.add(file.replace(/^\/+/, ''));
  }
  return [...urls].sort();
}

// PWA-T01: gotowość offline tylko przy komplecie — brak choćby jednego zasobu to brak gotowości.
export function missingUrls(expected: readonly string[], cached: readonly string[]): string[] {
  const present = new Set(cached);
  return expected.filter((url) => !present.has(url));
}

// PWA-T04: stare zasoby usuwamy dopiero po aktywacji nowej wersji (gdy stara sesja ich nie
// potrzebuje); obce cache (bez naszego prefiksu) zostają nietknięte.
export function staleCaches(names: readonly string[], current: string): string[] {
  return names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== current);
}

// Wersja wydania z nazw plików (zawierają skróty treści) i wersji aplikacji.
export function buildVersion(appVersion: string, files: readonly string[]): string {
  let hash = 2166136261;
  for (const char of [...files].sort().join('|')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `${appVersion}-${hash.toString(16).padStart(8, '0')}`;
}

// Komunikaty między aplikacją a service workerem.
export type WorkerRequest = { type: 'status' } | { type: 'skipWaiting' };
export type WorkerStatus = { type: 'status'; version: string; ready: boolean; missing: number };
