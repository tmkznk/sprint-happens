import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { buildVersion, precacheUrls } from './src/pwa/precache.ts';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

// F:PWA-01, T:PWA-T01, PWA-T04: service worker jako osobne wejście buildu pod stałą nazwą `sw.js`.
// Po złożeniu paczki wstrzykujemy do niego komplet zasobów wydania (pliki z buildu i `public/`)
// oraz wersję wyliczoną z ich nazw — każde wydanie ma własny, spójny cache.
function precacheManifest(): Plugin {
  let publicDir = '';
  return {
    name: 'sprint-happens-precache',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const urls = precacheUrls([...Object.keys(bundle), ...publicFiles(publicDir)]);
      const release = buildVersion(version, urls);
      const worker = bundle['sw.js'];
      if (worker?.type !== 'chunk') throw new Error('Brak sw.js w paczce');
      worker.code = worker.code
        .replace('__PRECACHE_URLS__', JSON.stringify(urls))
        .replace('__PRECACHE_VERSION__', JSON.stringify(release));
    },
  };
}

function publicFiles(dir: string): string[] {
  if (!dir) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'));
}

export default defineConfig({
  plugins: [react(), precacheManifest()],
  // Wersja buildu w kopercie zapisu (T:SAVE-T06).
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    rolldownOptions: {
      input: { main: 'index.html', sw: 'src/pwa/serviceWorker.ts' },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
