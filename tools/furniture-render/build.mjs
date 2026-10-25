// Renderuje meble gry we wszystkich obrotach do src/assets/furniture/ i zapisuje metadane kotwic
// w src/rendering/furnitureSprites.json. Użycie (z tego katalogu):
//   npm install && VNB_PACK="/ścieżka/VNB Low Poly Office Set 2" npm run render [-- typ…]
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { FURNITURE } from './furniture.mjs';
import { startServer } from './server.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PACK =
  process.env.VNB_PACK ??
  fileURLToPath(new URL('../../../VNB Low Poly Office Set 2', import.meta.url));
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCALE = 2; // rozdzielczość źródłowa: 2 px obrazu na 1 px gry
const only = process.argv.slice(2);

const metaFile = `${ROOT}src/rendering/furnitureSprites.json`;
const meta = JSON.parse(await readFile(metaFile, 'utf8').catch(() => '{}'));
const server = await startServer(PACK);
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error('pageerror', error.message));
  await page.goto('http://localhost:4401/');
  await page.waitForFunction(() => window.ready);
  await mkdir(`${ROOT}src/assets/furniture`, { recursive: true });
  for (const [type, spec] of Object.entries(FURNITURE)) {
    if (only.length > 0 && !only.includes(type)) continue;
    for (const rotation of [0, 90, 180, 270]) {
      const r = await page.evaluate((s) => window.renderSprite(s), {
        ...spec,
        rotation,
        scale: SCALE,
      });
      const key = `${type}-${rotation}`;
      await writeFile(
        `${ROOT}src/assets/furniture/${key}.png`,
        Buffer.from(r.dataURL.split(',')[1], 'base64'),
      );
      meta[key] = {
        width: r.width,
        height: r.height,
        anchorX: r.anchorX,
        anchorY: r.anchorY,
        heightPx: r.heightPx,
        scale: r.scale,
      };
      console.log(key, r.width, r.height);
    }
  }
  const sorted = Object.fromEntries(
    Object.entries(meta).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })),
  );
  await writeFile(metaFile, `${JSON.stringify(sorted, null, 2)}\n`);
} finally {
  await browser.close();
  server.close();
}
