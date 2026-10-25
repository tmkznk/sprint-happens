// Pre-render grafik gry z modeli 3D. Użycie (z tego katalogu):
//   npm install
//   VNB_PACK="/ścieżka/VNB Low Poly Office Set 2" \
//   KENNEY_PACK="/ścieżka/kenney_mini-characters" npm run render [-- cel…]
// Cele: typy mebli (desk, deskChair, sofa, coffeeMachine, plant) albo `characters`; bez celów —
// wszystko. Meble → src/assets/furniture/<typ>-<obrót>.png + src/rendering/furnitureSprites.json;
// postacie → src/assets/characters/<wygląd>.webp + src/rendering/characterSprites.json.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { ANIMS, CHARACTER, FACINGS, LOOKS } from './characters.mjs';
import { FURNITURE } from './furniture.mjs';
import { startServer } from './server.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PACK =
  process.env.VNB_PACK ??
  fileURLToPath(new URL('../../../VNB Low Poly Office Set 2', import.meta.url));
const KENNEY = process.env.KENNEY_PACK ? join(process.env.KENNEY_PACK, 'Models/GLB format') : null;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FURNITURE_SCALE = 2; // 2 px obrazu na 1 px gry
const CHARACTER_SCALE = 1.5; // postacie: mniejsze atlasy (WebP), wciąż ostre przy przybliżeniu
const targets = process.argv.slice(2);
const wanted = (name) => targets.length === 0 || targets.includes(name);

const server = await startServer(PACK, 4401, KENNEY);
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error('pageerror', error.message));
  await page.goto('http://localhost:4401/');
  await page.waitForFunction(() => window.ready);

  const furnitureMetaFile = `${ROOT}src/rendering/furnitureSprites.json`;
  const furnitureMeta = JSON.parse(await readFile(furnitureMetaFile, 'utf8').catch(() => '{}'));
  await mkdir(`${ROOT}src/assets/furniture`, { recursive: true });
  for (const [type, spec] of Object.entries(FURNITURE)) {
    if (!wanted(type)) continue;
    for (const rotation of [0, 90, 180, 270]) {
      const r = await page.evaluate((s) => window.renderSprite(s), {
        ...spec,
        rotation,
        scale: FURNITURE_SCALE,
      });
      const key = `${type}-${rotation}`;
      await writeFile(
        `${ROOT}src/assets/furniture/${key}.png`,
        Buffer.from(r.dataURL.split(',')[1], 'base64'),
      );
      const { width, height, anchorX, anchorY, heightPx, scale } = r;
      furnitureMeta[key] = { width, height, anchorX, anchorY, heightPx, scale };
      console.log(key, width, height);
    }
  }
  await writeFile(furnitureMetaFile, `${JSON.stringify(sortKeys(furnitureMeta), null, 2)}\n`);

  if (wanted('characters')) {
    if (!KENNEY) throw new Error('Ustaw KENNEY_PACK (katalog paczki Kenney Mini Characters)');
    await mkdir(`${ROOT}src/assets/characters`, { recursive: true });
    let frame = null;
    for (const look of LOOKS) {
      const r = await page.evaluate((s) => window.renderCharacterAtlas(s), {
        ...CHARACTER,
        character: `character-${look}`,
        facings: FACINGS,
        anims: ANIMS,
        scale: CHARACTER_SCALE,
        quality: 0.8,
      });
      await writeFile(
        `${ROOT}src/assets/characters/${look}.webp`,
        Buffer.from(r.dataURL.split(',')[1], 'base64'),
      );
      frame = { ...r };
      delete frame.dataURL;
      console.log(look, r.frameWidth, r.frameHeight);
    }
    const meta = {
      ...frame,
      looks: LOOKS,
      anims: Object.fromEntries(
        ANIMS.map((a) => [a.name, { ...frame.layout[a.name], fps: a.fps }]),
      ),
    };
    delete meta.layout;
    await writeFile(
      `${ROOT}src/rendering/characterSprites.json`,
      `${JSON.stringify(meta, null, 2)}\n`,
    );
  }
} finally {
  await browser.close();
  server.close();
}

function sortKeys(record) {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })),
  );
}
