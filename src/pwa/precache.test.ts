import { describe, expect, it } from 'vitest';
import { buildVersion, cacheName, missingUrls, precacheUrls, staleCaches } from './precache';

describe('lista zasobów offline (PWA-T01, PWA-T04)', () => {
  it('obejmuje stronę startową i pliki wydania; pomija sw.js i mapy', () => {
    expect(
      precacheUrls(['index.html', 'sw.js', 'assets/a-1.js', 'assets/a-1.js.map', '/icons/i.png']),
    ).toEqual(['./', 'assets/a-1.js', 'icons/i.png', 'index.html']);
  });

  it('gotowość tylko przy komplecie', () => {
    expect(missingUrls(['a', 'b'], ['a', 'b', 'c'])).toEqual([]);
    expect(missingUrls(['a', 'b'], ['a'])).toEqual(['b']);
  });

  it('usuwa tylko własne cache innych wersji', () => {
    const current = cacheName('2');
    expect(staleCaches([cacheName('1'), current, 'obcy-cache'], current)).toEqual([cacheName('1')]);
  });

  it('wersja zależy od zestawu plików, nie od kolejności', () => {
    expect(buildVersion('0.1.0', ['a', 'b'])).toBe(buildVersion('0.1.0', ['b', 'a']));
    expect(buildVersion('0.1.0', ['a', 'b'])).not.toBe(buildVersion('0.1.0', ['a', 'c']));
    expect(buildVersion('0.1.0', ['a'])).toMatch(/^0\.1\.0-[0-9a-f]{8}$/);
  });
});
