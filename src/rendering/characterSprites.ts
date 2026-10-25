import * as Phaser from 'phaser';
import type { PersonId } from '../domain/content/people';
import type { AgentStatus } from '../domain/movement';
import type { AgentPose, Facing, PoseKind } from './agentPose';
import meta from './characterSprites.json';
import { SELECTION_COLOR } from './placeholderStyle';
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

export type CharacterSprite = {
  body: Phaser.GameObjects.Sprite;
  ring: Phaser.GameObjects.Graphics;
  personId: PersonId;
  ready: boolean;
  facing: Facing;
  destroy(): void;
};

export function createCharacterSprite(scene: Phaser.Scene, personId: PersonId): CharacterSprite {
  const ring = scene.add.graphics();
  const body = scene.add
    .sprite(0, 0, '__MISSING')
    .setOrigin(SHEET.anchorX / SHEET.frameWidth, SHEET.anchorY / SHEET.frameHeight)
    .setScale(1 / SHEET.scale)
    .setVisible(false);
  const sprite: CharacterSprite = {
    body,
    ring,
    personId,
    ready: false,
    facing: 'px',
    destroy() {
      body.destroy();
      ring.destroy();
    },
  };
  ensureCharacterTexture(scene, personId, () => {
    if (!body.active) return;
    body.setTexture(textureKey(personId)).setVisible(true);
    sprite.ready = true;
  });
  return sprite;
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
  sprite.ring.clear();
  if (WARNING_STATUSES.includes(status)) {
    sprite.ring.fillStyle(0xff3b3b, 0.55).fillEllipse(0, 0, 30, 13);
  }
  if (selected) sprite.ring.lineStyle(3, SELECTION_COLOR, 1).strokeEllipse(0, 0, 34, 16);
  sprite.ring.setPosition(screen.x, screen.y).setDepth(pose.depth - 0.001);
}
