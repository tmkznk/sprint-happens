import * as Phaser from 'phaser';
import type { PersonId } from '../domain/content/people';
import type { AgentStatus } from '../domain/movement';
import type { AgentPose, Facing, PoseKind } from './agentPose';
import meta from './characterSprites.json';
import { SELECTION_MARKER_COLOR, SELECTION_MARKER_OUTLINE } from './placeholderStyle';
import { gridToScreen } from './projection';

// Własne postacie low poly pre-renderowane do atlasów WebP (tools/furniture-render), jeden atlas
// na osobę z listy postaci: wiersz = kierunek, kolumny = klatki kolejnych animacji.
type CharacterMeta = {
  frameWidth: number;
  frameHeight: number;
  anchorX: number;
  anchorY: number;
  scale: number;
  columns: number;
  rows: Facing[];
  anims: Record<PoseKind, { start: number; frames: number; fps: number }>;
};

const SHEET = meta as CharacterMeta;

const ATLAS_URLS = import.meta.glob<string>('../assets/characters/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

const textureKey = (personId: PersonId) => `character-${personId}`;
const animKey = (personId: PersonId, kind: PoseKind, facing: Facing) =>
  `${personId}-${kind}-${facing}`;

// Atlasy są ładowane na żądanie — w biurze jest naraz kilka osób, a komplet 63 tekstur
// zająłby niepotrzebnie pamięć karty graficznej. Pliki i tak są w cache offline (precache).
function ensureCharacterTexture(scene: Phaser.Scene, personId: PersonId, onReady: () => void) {
  const key = textureKey(personId);
  if (scene.textures.exists(key)) {
    onReady();
    return;
  }
  const url = ATLAS_URLS[`../assets/characters/${personId}.webp`];
  if (!url) return;
  scene.load.once(`filecomplete-spritesheet-${key}`, () => {
    createAnimations(scene, personId);
    onReady();
  });
  if (!scene.load.textureManager.exists(key)) {
    scene.load.spritesheet(key, url, {
      frameWidth: SHEET.frameWidth,
      frameHeight: SHEET.frameHeight,
    });
  }
  if (!scene.load.isLoading()) scene.load.start();
}

function createAnimations(scene: Phaser.Scene, personId: PersonId): void {
  const texture = textureKey(personId);
  scene.textures.get(texture).setFilter(Phaser.Textures.FilterMode.LINEAR);
  SHEET.rows.forEach((facing, row) => {
    for (const [kind, anim] of Object.entries(SHEET.anims) as [
      PoseKind,
      CharacterMeta['anims'][PoseKind],
    ][]) {
      const key = animKey(personId, kind, facing);
      if (scene.anims.exists(key)) continue;
      const first = row * SHEET.columns + anim.start;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(texture, {
          start: first,
          end: first + anim.frames - 1,
        }),
        frameRate: anim.fps,
        repeat: -1,
      });
    }
  });
}

const WARNING_STATUSES: readonly AgentStatus[] = ['noRoute', 'deadlocked'];

// Znacznik zaznaczenia (wariant D): pulsujący pierścień pod stopami i unosząca się strzałka nad
// głową. Animują je tweeny (alfa, przesunięcie) — Graphics pierścienia przerysowujemy tylko przy
// zmianie znacznika, a strzałka to tekstura wygenerowana raz na scenę.
const CHEVRON_TEXTURE = 'selection-chevron';
const CHEVRON_WIDTH = 16;
const CHEVRON_HEIGHT = 12;
// Strzałka nad czubkiem klatki postaci (punkt zaczepienia jest przy stopach).
const CHEVRON_GAP = 2;
const MARKER_PULSE_MS = 1400;
const CHEVRON_LIFT = 6;
// Strzałka to element interfejsu — zawsze nad biurem, także nad przednimi ścianami.
const CHEVRON_DEPTH = 2_000_000;

function ensureChevronTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(CHEVRON_TEXTURE)) return;
  const pad = 2;
  const w = CHEVRON_WIDTH;
  const h = CHEVRON_HEIGHT;
  // Gruby „V” skierowany w dół, z ciemną obwódką.
  const points = [
    { x: pad, y: pad },
    { x: pad + w * 0.32, y: pad },
    { x: pad + w / 2, y: pad + h * 0.5 },
    { x: pad + w * 0.68, y: pad },
    { x: pad + w, y: pad },
    { x: pad + w / 2, y: pad + h },
  ].map((point) => new Phaser.Math.Vector2(point.x, point.y));
  const graphics = scene.make.graphics({}, false);
  graphics.fillStyle(SELECTION_MARKER_COLOR, 1).fillPoints(points, true);
  graphics.lineStyle(2, SELECTION_MARKER_OUTLINE, 1).strokePoints(points, true, true);
  graphics.generateTexture(CHEVRON_TEXTURE, w + pad * 2, h + pad * 2);
  graphics.destroy();
  scene.textures.get(CHEVRON_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
}

export type CharacterSprite = {
  body: Phaser.GameObjects.Sprite;
  ring: Phaser.GameObjects.Graphics;
  chevron: Phaser.GameObjects.Image;
  personId: PersonId;
  ready: boolean;
  facing: Facing;
  // Narysowany znacznik pod stopami — Graphics przerysowujemy tylko przy jego zmianie.
  ringKey: string;
  // Tweeny znacznika zaznaczenia — działają tylko dla zaznaczonej postaci.
  markerTweens: Phaser.Tweens.Tween[];
  // Bieżące uniesienie strzałki (animowane tweenem, stosowane przy ustawianiu pozycji).
  lift: { value: number };
  destroy(): void;
};

export function createCharacterSprite(scene: Phaser.Scene, personId: PersonId): CharacterSprite {
  ensureChevronTexture(scene);
  const ring = scene.add.graphics();
  const body = scene.add
    .sprite(0, 0, '__MISSING')
    .setOrigin(SHEET.anchorX / SHEET.frameWidth, SHEET.anchorY / SHEET.frameHeight)
    .setScale(1 / SHEET.scale)
    .setVisible(false);
  const chevron = scene.add
    .image(0, 0, CHEVRON_TEXTURE)
    .setOrigin(0.5, 1)
    .setDepth(CHEVRON_DEPTH)
    .setVisible(false);
  const sprite: CharacterSprite = {
    body,
    ring,
    chevron,
    personId,
    ready: false,
    facing: 'px',
    ringKey: '',
    markerTweens: [],
    lift: { value: 0 },
    destroy() {
      stopMarkerTweens(sprite);
      body.destroy();
      ring.destroy();
      chevron.destroy();
    },
  };
  ensureCharacterTexture(scene, personId, () => {
    if (!body.active) return;
    body.setTexture(textureKey(personId)).setVisible(true);
    sprite.ready = true;
  });
  return sprite;
}

function stopMarkerTweens(sprite: CharacterSprite): void {
  for (const tween of sprite.markerTweens) tween.remove();
  sprite.markerTweens = [];
  sprite.ring.setAlpha(1);
  sprite.lift.value = 0;
}

function startMarkerTweens(sprite: CharacterSprite): void {
  const { tweens } = sprite.ring.scene;
  sprite.markerTweens = [
    tweens.add({
      targets: sprite.ring,
      alpha: { from: 1, to: 0.55 },
      duration: MARKER_PULSE_MS / 2,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    }),
    tweens.add({
      targets: sprite.lift,
      value: { from: 0, to: CHEVRON_LIFT },
      duration: MARKER_PULSE_MS / 2,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    }),
  ];
}

// Pozycja, animacja i znaczniki postaci. `timeScale` — tempo gry (0 = pauza zatrzymuje animację).
export function placeCharacterSprite(
  sprite: CharacterSprite,
  pose: AgentPose,
  status: AgentStatus,
  timeScale: number,
  selected: boolean,
): void {
  if (pose.facing) sprite.facing = pose.facing;
  const screen = gridToScreen(pose.position);
  sprite.body.setPosition(screen.x, screen.y).setDepth(pose.depth);
  if (sprite.ready) {
    const key = animKey(sprite.personId, pose.kind, sprite.facing);
    if (sprite.body.anims.currentAnim?.key !== key) sprite.body.play(key);
    sprite.body.anims.timeScale = timeScale;
  }

  // Znacznik pod stopami: zaznaczenie albo problem z ruchem (brak drogi, blokada).
  const warning = WARNING_STATUSES.includes(status);
  const ringKey = `${String(warning)}|${String(selected)}`;
  if (ringKey !== sprite.ringKey) {
    const wasSelected = sprite.ringKey.endsWith('|true');
    sprite.ringKey = ringKey;
    sprite.ring.clear();
    if (warning) sprite.ring.fillStyle(0xff3b3b, 0.55).fillEllipse(0, 0, 30, 13);
    if (selected) {
      sprite.ring
        .lineStyle(6, SELECTION_MARKER_OUTLINE, 1)
        .strokeEllipse(0, 0, 36, 17)
        .lineStyle(3, SELECTION_MARKER_COLOR, 1)
        .strokeEllipse(0, 0, 36, 17);
    }
    if (selected && !wasSelected) startMarkerTweens(sprite);
    if (!selected && wasSelected) stopMarkerTweens(sprite);
  }
  sprite.ring.setVisible(warning || selected);
  sprite.ring.setPosition(screen.x, screen.y).setDepth(pose.depth - 0.001);
  sprite.chevron.setVisible(selected);
  if (selected) {
    sprite.chevron.setPosition(
      screen.x,
      screen.y - SHEET.anchorY / SHEET.scale - CHEVRON_GAP - sprite.lift.value,
    );
  }
}
