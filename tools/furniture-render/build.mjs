// Pre-render grafik gry z modeli 3D. Użycie (z tego katalogu):
//   npm install
//   VNB_PACK="/ścieżka/VNB Low Poly Office Set 2" npm run render [-- cel…]
// Cele: typy mebli (desk, deskChair, sofa, coffeeMachine, plant), `rooms`, `characters` albo id osoby; bez celów —
// wszystko. Meble → src/assets/furniture/<typ>-<obrót>.png + src/rendering/furnitureSprites.json;
// postacie (własne, low poly) → src/assets/characters/<id osoby>.webp
// + src/rendering/characterSprites.json.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { ANIMS, CHARACTER, FACINGS, LOOKS } from './characters.mjs';
import { FURNITURE } from './furniture.mjs';
import { ROOMS } from './rooms.mjs';
import { startServer } from './server.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PACK =
  process.env.VNB_PACK ??
  fileURLToPath(new URL('../../../VNB Low Poly Office Set 2', import.meta.url));
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FURNITURE_SCALE = 2; // 2 px obrazu na 1 px gry
const CHARACTER_SCALE = 1; // postacie: 1 px obrazu na 1 px gry — płaskie kolory dobrze znoszą skalowanie
const targets = process.argv.slice(2);
const wanted = (name) => targets.length === 0 || targets.includes(name);

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

  // Pomieszczenia: warstwa tylna (podłoga, ściany, drzwi, dekoracje) i przednia (niskie ściany
  // od strony kamery) → src/assets/rooms/<id>-<warstwa>.png + src/rendering/roomSprites.json.
  if (wanted('rooms')) {
    await mkdir(`${ROOT}src/assets/rooms`, { recursive: true });
    const roomMeta = {};
    for (const [id, spec] of Object.entries(ROOMS)) {
      for (const layer of ['back', 'front']) {
        const r = await page.evaluate((s) => window.renderRoom(s), {
          ...spec,
          layer,
          scale: FURNITURE_SCALE,
        });
        await writeFile(
          `${ROOT}src/assets/rooms/${id}-${layer}.png`,
          Buffer.from(r.dataURL.split(',')[1], 'base64'),
        );
        const { width, height, anchorX, anchorY, scale } = r;
        roomMeta[id] = { width, height, anchorX, anchorY, scale };
        console.log(`${id}-${layer}`, width, height);
      }
    }
    await writeFile(
      `${ROOT}src/rendering/roomSprites.json`,
      `${JSON.stringify(roomMeta, null, 2)}\n`,
    );
  }

  // Postacie: wszystkie (`characters`) albo wybrane po id osoby.
  const characterTargets = LOOKS.filter(({ id }) => wanted('characters') || targets.includes(id));
  if (characterTargets.length > 0) {
    await mkdir(`${ROOT}src/assets/characters`, { recursive: true });
    let frame = null;
    for (const { id, look } of characterTargets) {
      const r = await page.evaluate((s) => window.renderCharacterAtlas(s), {
        ...CHARACTER,
        look,
        facings: FACINGS,
        anims: ANIMS,
        scale: CHARACTER_SCALE,
        quality: 0.75,
      });
      await writeFile(
        `${ROOT}src/assets/characters/${id}.webp`,
        Buffer.from(r.dataURL.split(',')[1], 'base64'),
      );
      frame = { ...r };
      delete frame.dataURL;
      console.log(id, r.frameWidth, r.frameHeight);
    }
    const meta = {
      ...frame,
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
