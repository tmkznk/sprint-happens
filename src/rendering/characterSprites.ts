import * as Phaser from 'phaser';
import { LOOKS, type Look } from '../domain/content/people';
import type { AgentStatus } from '../domain/movement';
import type { AgentPose, Facing, PoseKind } from './agentPose';
import meta from './characterSprites.json';
import { SELECTION_COLOR } from './placeholderStyle';
import { gridToScreen } from './projection';

// Postacie (Kenney Mini Characters, CC0) pre-renderowane do atlasów WebP
// (tools/furniture-render): wiersz = kierunek, kolumny = klatki kolejnych animacji.
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

const textureKey = (look: Look) => `character-${look}`;
const animKey = (look: Look, kind: PoseKind, facing: Facing) => `${look}-${kind}-${facing}`;

export function preloadCharacters(scene: Phaser.Scene): void {
  for (const look of LOOKS) {
    const url = ATLAS_URLS[`../assets/characters/${look}.webp`];
    if (!url) continue;
    scene.load.spritesheet(textureKey(look), url, {
      frameWidth: SHEET.frameWidth,
      frameHeight: SHEET.frameHeight,
    });
  }
}

// Animacje dla każdego wyglądu, pozy i kierunku — raz na scenę.
export function createCharacterAnimations(scene: Phaser.Scene): void {
  for (const look of LOOKS) {
    const texture = textureKey(look);
    if (!scene.textures.exists(texture)) continue;
    scene.textures.get(texture).setFilter(Phaser.Textures.FilterMode.LINEAR);
    SHEET.rows.forEach((facing, row) => {
      for (const [kind, anim] of Object.entries(SHEET.anims) as [
        PoseKind,
        CharacterMeta['anims'][PoseKind],
      ][]) {
        const key = animKey(look, kind, facing);
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
}

// Wysokość postaci w pikselach gry (do trafiania dotykiem i zaznaczenia).
export const CHARACTER_HEIGHT = Math.round((SHEET.anchorY - 8) / SHEET.scale);

const WARNING_STATUSES: readonly AgentStatus[] = ['noRoute', 'deadlocked'];

export type CharacterSprite = {
  body: Phaser.GameObjects.Sprite;
  ring: Phaser.GameObjects.Graphics;
  look: Look;
  facing: Facing;
  destroy(): void;
};

export function createCharacterSprite(scene: Phaser.Scene, look: Look): CharacterSprite {
  const ring = scene.add.graphics();
  const body = scene.add
    .sprite(0, 0, textureKey(look))
    .setOrigin(SHEET.anchorX / SHEET.frameWidth, SHEET.anchorY / SHEET.frameHeight)
    .setScale(1 / SHEET.scale);
  return {
    body,
    ring,
    look,
    facing: 'px',
    destroy() {
      body.destroy();
      ring.destroy();
    },
  };
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
  const key = animKey(sprite.look, pose.kind, sprite.facing);
  if (sprite.body.anims.currentAnim?.key !== key) sprite.body.play(key);
  sprite.body.anims.timeScale = timeScale;

  // Znacznik pod stopami: zaznaczenie albo problem z ruchem (brak drogi, blokada).
  sprite.ring.clear();
  const warning = WARNING_STATUSES.includes(status);
  if (warning) sprite.ring.fillStyle(0xff3b3b, 0.55).fillEllipse(0, 0, 30, 13);
  if (selected) sprite.ring.lineStyle(3, SELECTION_COLOR, 1).strokeEllipse(0, 0, 34, 16);
  sprite.ring.setPosition(screen.x, screen.y).setDepth(pose.depth - 0.001);
}
