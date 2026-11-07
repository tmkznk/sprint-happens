// Pre-render grafik gry z modeli 3D. Użycie (z tego katalogu):
//   npm install
//   VNB_PACK="/ścieżka/VNB Low Poly Office Set 2" npm run render [-- cel…]
// Cele: typy mebli (desk, deskChair, sofa, coffeeMachine, plant), `rooms`, `characters`, `smokers` albo id osoby;
// bez celów — wszystko. RENDER_OUT=/katalog — zapis pod tym katalogiem zamiast do repozytorium (próbki);
// SMOKERS=id,id — atlasy palenia dla tych osób zamiast osób z `cigarettesPerDay` > 0. Meble → src/assets/furniture/<typ>-<obrót>.png + src/rendering/furnitureSprites.json;
// postacie (własne, low poly) → src/assets/characters/<id osoby>.webp
// + src/rendering/characterSprites.json.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import {
  ANIMS,
  CHARACTER,
  FACINGS,
  LOOKS,
  SMOKE_ANIM,
  SMOKE_CHARACTER,
  SMOKE_FACINGS,
  SHADOW_ANIM,
  SHADOW_CHARACTER,
} from './characters.mjs';
import { FURNITURE } from './furniture.mjs';
import { ROOMS } from './rooms.mjs';
import { startServer } from './server.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = process.env.RENDER_OUT ? `${process.env.RENDER_OUT.replace(/\/$/, '')}/` : ROOT;
const PACK =
  process.env.VNB_PACK ??
  fileURLToPath(new URL('../../../VNB Low Poly Office Set 2', import.meta.url));
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FURNITURE_SCALE = 2; // 2 px obrazu na 1 px gry
const CHARACTER_SCALE = 2; // postacie w tej samej rozdzielczości co meble (decyzja właściciela)
const CHARACTER_QUALITY = 0.75; // WebP: wyższa jakość prawie niewidoczna, a pliki o połowę większe
// Fazy otwarcia drzwi wejściowych (stopnie, skrzydło na zewnątrz); 0° to samo tło pomieszczenia.
const DOOR_ANGLES = [15, 30, 45, 60, 75];
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

  await mkdir(`${OUT}src/rendering`, { recursive: true });
  const furnitureMetaFile = `${OUT}src/rendering/furnitureSprites.json`;
  const furnitureMeta = JSON.parse(await readFile(furnitureMetaFile, 'utf8').catch(() => '{}'));
  await mkdir(`${OUT}src/assets/furniture`, { recursive: true });
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
        `${OUT}src/assets/furniture/${key}.png`,
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
    await mkdir(`${OUT}src/assets/rooms`, { recursive: true });
    const roomMeta = {};
    for (const [id, spec] of Object.entries(ROOMS)) {
      let back = null;
      for (const layer of ['back', 'front']) {
        const r = await page.evaluate((s) => window.renderRoom(s), {
          ...spec,
          layer,
          scale: FURNITURE_SCALE,
        });
        await writeFile(
          `${OUT}src/assets/rooms/${id}-${layer}.png`,
          Buffer.from(r.dataURL.split(',')[1], 'base64'),
        );
        const { width, height, anchorX, anchorY, scale } = r;
        roomMeta[id] = { width, height, anchorX, anchorY, scale };
        if (layer === 'back') back = r;
        console.log(`${id}-${layer}`, width, height);
      }
      // Drzwi wejściowe: fazy otwarcia jako wycinki tła (to, co się zmienia: skrzydło, otwór,
      // światło na podłodze) w pasku <id>-door.png; w grze kładzione na tło według stanu drzwi.
      // Zamknięte drzwi to samo tło — faza 0° nie ma klatki.
      const door = spec.doors?.[0];
      if (door && back) {
        const frames = [];
        for (const open of DOOR_ANGLES) {
          const r = await page.evaluate((s) => window.renderRoom(s), {
            ...spec,
            doors: spec.doors.map((d, i) => (i === 0 ? { ...d, open } : d)),
            layer: 'back',
            scale: FURNITURE_SCALE,
          });
          frames.push(r.dataURL);
        }
        // Obszar szukania zmian: kilka pól wokół drzwi, od wierzchu ściany do podłogi.
        const cell =
          door.axis === 'z'
            ? { x: Math.floor(door.at), y: Math.floor(door.center) }
            : { x: Math.floor(door.center), y: Math.floor(door.at) };
        const S = FURNITURE_SCALE;
        const cx = back.anchorX + (cell.x - cell.y) * 32 * S;
        const cy = back.anchorY + (cell.x + cell.y + 1) * 16 * S;
        // Lewa granica nie dalej niż koniec ściany z drzwiami (dla ściany z: jej koniec przy
        // większym z) — tło za otworem nie może wyjrzeć zza ściany.
        const t = spec.wallThickness / 2;
        const wallEnd = Math.max(
          ...spec.walls
            .filter((w) => w.axis === door.axis && w.at === door.at && !w.partition)
            .map((w) => w.to),
        );
        const endX =
          door.axis === 'z'
            ? back.anchorX + (door.at - t - wallEnd) * 32 * S
            : back.anchorX - Infinity;
        const roi = {
          x0: Math.max(0, Math.round(cx - 4 * 32 * S), Math.ceil(endX)),
          x1: Math.min(back.width, Math.round(cx + 4 * 32 * S)),
          y0: Math.max(0, Math.round(cy - 10 * 16 * S)),
          y1: Math.min(back.height, Math.round(cy + 4 * 16 * S)),
        };
        const strip = await page.evaluate(
          ({ base, frames, roi }) => window.doorStrip(base, frames, roi),
          { base: back.dataURL, frames, roi },
        );
        await writeFile(
          `${OUT}src/assets/rooms/${id}-door.png`,
          Buffer.from(strip.dataURL.split(',')[1], 'base64'),
        );
        roomMeta[id].door = {
          ...cell,
          angles: DOOR_ANGLES,
          gap: strip.gap,
          width: strip.width,
          height: strip.height,
          anchorX: back.anchorX - strip.x,
          anchorY: back.anchorY - strip.y,
        };
        console.log(`${id}-door`, strip.width, strip.height, DOOR_ANGLES.length);
      }
      // Teren na zewnątrz powiększa obraz, ale widok startowy pokazuje samo biuro: wymiary tego
      // samego pomieszczenia bez `outdoor` → `fit` (kamera, `roomFitBounds`).
      if (spec.outdoor) {
        const { width, height, anchorX, anchorY } = await page.evaluate(
          (s) => window.renderRoom(s),
          { ...spec, outdoor: undefined, layer: 'back', scale: FURNITURE_SCALE },
        );
        roomMeta[id].fit = { width, height, anchorX, anchorY };
      }
      // Ściany działowe: kawałek na każde pole, przez które przechodzą (w grze każdy z własną
      // głębokością — postać stoi przed ścianką albo za nią), spakowane w jeden atlas
      // <id>-pieces.png.
      const pieces = [];
      for (const cell of partitionCells(spec)) {
        const r = await page.evaluate((s) => window.renderRoom(s), {
          ...spec,
          layer: 'piece',
          piece: { x: cell.x, z: cell.y },
          scale: FURNITURE_SCALE,
        });
        if (r) pieces.push({ cell, r });
      }
      if (pieces.length > 0) {
        const atlas = await page.evaluate(
          (images) => window.packAtlas(images),
          pieces.map(({ r }) => r.dataURL),
        );
        await writeFile(
          `${OUT}src/assets/rooms/${id}-pieces.png`,
          Buffer.from(atlas.dataURL.split(',')[1], 'base64'),
        );
        roomMeta[id].pieces = pieces.map(({ cell, r }, i) => ({
          ...cell,
          frameX: atlas.frames[i].x,
          frameY: atlas.frames[i].y,
          width: r.width,
          height: r.height,
          anchorX: r.anchorX,
          anchorY: r.anchorY,
        }));
        console.log(`${id}-pieces`, pieces.length);
      }
    }
    await writeFile(
      `${OUT}src/rendering/roomSprites.json`,
      `${JSON.stringify(roomMeta, null, 2)}\n`,
    );
  }

  // Postacie: wszystkie (`characters`) albo wybrane po id osoby.
  const characterTargets = LOOKS.filter(({ id }) => wanted('characters') || targets.includes(id));
  if (characterTargets.length > 0) {
    await mkdir(`${OUT}src/assets/characters`, { recursive: true });
    let frame = null;
    for (const { id, look } of characterTargets) {
      const r = await page.evaluate((s) => window.renderCharacterAtlas(s), {
        ...CHARACTER,
        look,
        facings: FACINGS,
        anims: ANIMS,
        scale: CHARACTER_SCALE,
        quality: CHARACTER_QUALITY,
      });
      await writeFile(
        `${OUT}src/assets/characters/${id}.webp`,
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
      `${OUT}src/rendering/characterSprites.json`,
      `${JSON.stringify(meta, null, 2)}\n`,
    );
  }

  // Wspólny cień postaci → src/assets/characters/shadow/shadow.webp + src/rendering/characterShadow.json
  if (wanted('shadow')) {
    const r = await page.evaluate((s) => window.renderCharacterAtlas(s), {
      ...SHADOW_CHARACTER,
      look: LOOKS[0].look,
      facings: SMOKE_FACINGS,
      anims: [SHADOW_ANIM],
      scale: CHARACTER_SCALE,
      quality: 0.9,
    });
    await mkdir(`${OUT}src/assets/characters/shadow`, { recursive: true });
    await writeFile(
      `${OUT}src/assets/characters/shadow/shadow.webp`,
      Buffer.from(r.dataURL.split(',')[1], 'base64'),
    );
    const { frameWidth, frameHeight, anchorX, anchorY, scale } = r;
    await writeFile(
      `${OUT}src/rendering/characterShadow.json`,
      `${JSON.stringify({ width: frameWidth, height: frameHeight, anchorX, anchorY, scale }, null, 2)}\n`,
    );
    console.log('shadow', r.frameWidth, r.frameHeight, r.anchorX, r.anchorY);
  }

  // Palenie: małe atlasy tylko dla palaczy → src/assets/characters/smoke/<id osoby>.webp
  // + src/rendering/smokingSprites.json. Papieros i dym są wtopione w klatki.
  if (wanted('smokers')) {
    const chosen = process.env.SMOKERS?.split(',');
    const smokers = LOOKS.filter(({ id, cigarettesPerDay }) =>
      chosen ? chosen.includes(id) : cigarettesPerDay > 0,
    );
    await mkdir(`${OUT}src/assets/characters/smoke`, { recursive: true });
    let frame = null;
    for (const { id, look } of smokers) {
      const r = await page.evaluate((s) => window.renderCharacterAtlas(s), {
        ...SMOKE_CHARACTER,
        look,
        facings: SMOKE_FACINGS,
        anims: [SMOKE_ANIM],
        scale: CHARACTER_SCALE,
        quality: CHARACTER_QUALITY,
      });
      await writeFile(
        `${OUT}src/assets/characters/smoke/${id}.webp`,
        Buffer.from(r.dataURL.split(',')[1], 'base64'),
      );
      frame = { ...r };
      delete frame.dataURL;
      console.log(`smoke/${id}`, r.frameWidth, r.frameHeight);
    }
    if (frame) {
      const meta = {
        ...frame,
        anims: { smoke: { ...frame.layout.smoke, fps: SMOKE_ANIM.fps } },
      };
      delete meta.layout;
      await writeFile(
        `${OUT}src/rendering/smokingSprites.json`,
        `${JSON.stringify(meta, null, 2)}\n`,
      );
    }
  }
} finally {
  await browser.close();
  server.close();
}

// Pola siatki, przez które przechodzą ściany działowe (tafla leży w polu linii `at`). Pola
// przejść dają puste kawałki — pomijane przy renderze.
function partitionCells(spec) {
  const cells = new Map();
  for (const w of spec.walls) {
    if (!w.partition) continue;
    const line = Math.floor(w.at);
    for (let a = Math.floor(w.from); a < Math.ceil(w.to); a++) {
      const cell = w.axis === 'x' ? { x: a, y: line } : { x: line, y: a };
      cells.set(`${cell.x},${cell.y}`, cell);
    }
  }
  return [...cells.values()];
}

function sortKeys(record) {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })),
  );
}
