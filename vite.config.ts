import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  // Wersja buildu w kopercie zapisu (T:SAVE-T06).
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
