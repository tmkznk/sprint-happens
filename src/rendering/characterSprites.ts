import * as Phaser from 'phaser';
import type { PersonId } from '../domain/content/people';
import type { AgentStatus } from '../domain/movement';
import type { AgentPose, Facing, PoseKind } from './agentPose';
import shadowUrl from '../assets/characters/shadow/shadow.webp?url';
import {
  castsFloorShadow,
  CHARACTER_SHADOW,
  CHARACTER_SHEET as SHEET,
  SMOKE_SHEET,
  shownPoseKind,
  sheetOrigin,
  type SheetMeta,
} from './characterSheets';
import { firstNameOf, NAME_TAG, nameTagSize } from './nameTag';
import { SELECTION_MARKER_COLOR } from './placeholderStyle';
import { CHARACTER_RING_DEPTH, CHARACTER_SHADOW_DEPTH, gridToScreen } from './projection';

// Własne postacie pre-renderowane do atlasów WebP (tools/furniture-render), jeden atlas
// na osobę z listy postaci: wiersz = kierunek, kolumny = klatki kolejnych animacji.
const ATLAS_URLS = import.meta.glob<string>('../assets/characters/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

// Atlasy palenia są tylko dla palaczy (`cigarettesPerDay` > 0), w osobnym katalogu.
const SMOKE_ATLAS_URLS = import.meta.glob<string>('../assets/characters/smoke/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

const SHADOW_TEXTURE = 'character-shadow';

// Tekstura wspólna dla wszystkich postaci, ładowana raz (1 KB).
function ensureShadowTexture(scene: Phaser.Scene, onReady: () => void) {
  if (scene.textures.exists(SHADOW_TEXTURE)) {
    onReady();
    return;
  }
  scene.load.once(`filecomplete-image-${SHADOW_TEXTURE}`, () => {
    scene.textures.get(SHADOW_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    onReady();
  });
  scene.load.image(SHADOW_TEXTURE, shadowUrl);
  if (!scene.load.isLoading()) scene.load.start();
}

const textureKey = (personId: PersonId) => `character-${personId}`;
const smokeTextureKey = (personId: PersonId) => `character-smoke-${personId}`;
const animKey = (personId: PersonId, kind: PoseKind, facing: Facing) =>
  `${personId}-${kind}-${facing}`;

// Atlasy są ładowane na żądanie — w biurze jest naraz kilka osób, a komplet 63 tekstur
// zająłby niepotrzebnie pamięć karty graficznej. Pliki i tak są w cache offline (precache).
function ensureCharacterTexture(scene: Phaser.Scene, personId: PersonId, onReady: () => void) {
  const url = ATLAS_URLS[`../assets/characters/${personId}.webp`];
  ensureSheetTexture(scene, personId, textureKey(personId), SHEET, url, onReady);
}

// Atlas palenia: tak samo na żądanie, dopiero gdy osoba pierwszy raz stanie na tarasie.
function ensureSmokeTexture(scene: Phaser.Scene, personId: PersonId, onReady: () => void) {
  const url = SMOKE_ATLAS_URLS[`../assets/characters/smoke/${personId}.webp`];
  ensureSheetTexture(scene, personId, smokeTextureKey(personId), SMOKE_SHEET, url, onReady);
}

function ensureSheetTexture<Kind extends PoseKind>(
  scene: Phaser.Scene,
  personId: PersonId,
  key: string,
  sheet: SheetMeta<Kind>,
  url: string | undefined,
  onReady: () => void,
) {
  if (scene.textures.exists(key)) {
    onReady();
    return;
  }
  if (!url) return;
  scene.load.once(`filecomplete-spritesheet-${key}`, () => {
    createAnimations(scene, personId, key, sheet);
    onReady();
  });
  if (!scene.load.textureManager.exists(key)) {
    scene.load.spritesheet(key, url, {
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
    });
  }
  if (!scene.load.isLoading()) scene.load.start();
}

function createAnimations<Kind extends PoseKind>(
  scene: Phaser.Scene,
  personId: PersonId,
  texture: string,
  sheet: SheetMeta<Kind>,
): void {
  scene.textures.get(texture).setFilter(Phaser.Textures.FilterMode.LINEAR);
  sheet.rows.forEach((facing, row) => {
    for (const [kind, anim] of Object.entries(sheet.anims) as [
      Kind,
      SheetMeta<Kind>['anims'][Kind],
    ][]) {
      const key = animKey(personId, kind, facing);
      if (scene.anims.exists(key)) continue;
      const first = row * sheet.columns + anim.start;
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

// Znacznik zaznaczenia: pulsujący pierścień na podłodze i unoszący się dymek z imieniem nad głową.
// Animują je tweeny (alfa, przesunięcie) — Graphics pierścienia przerysowujemy tylko przy zmianie
// znacznika, a dymek to tekstura tworzona raz na imię, przy pierwszym zaznaczeniu.
const NAME_TAG_TEXTURE_PREFIX = 'name-tag-';
const NAME_TAG_SCALE = 2;
const NAME_TAG_TEXT_COLOR = '#0d3321';
const NAME_TAG_FONT = `600 ${String(NAME_TAG.fontSize * NAME_TAG_SCALE)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ui-sans-serif, system-ui, sans-serif`;
// Dymek nad czubkiem klatki postaci (punkt zaczepienia jest przy stopach).
const NAME_TAG_GAP = 2;
// Siedząca postać jest niższa niż klatka — dymek schodzi do głowy (px świata, z pomiaru atlasów).
const SEATED_NAME_TAG_DROP = 16;
const SEATED_POSES: readonly PoseKind[] = ['sitChair', 'typing', 'sitSofa'];
const MARKER_PULSE_MS = 1400;
const NAME_TAG_LIFT = 3;
// Dymek to element interfejsu — zawsze nad biurem, także nad przednimi ścianami.
const NAME_TAG_DEPTH = 2_000_000;

function ensureNameTagTexture(scene: Phaser.Scene, label: string): string {
  const key = `${NAME_TAG_TEXTURE_PREFIX}${label}`;
  if (scene.textures.exists(key)) return key;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return key;
  measure.font = NAME_TAG_FONT;
  const size = nameTagSize(measure.measureText(label).width / NAME_TAG_SCALE);
  const texture = scene.textures.createCanvas(
    key,
    size.width * NAME_TAG_SCALE,
    size.height * NAME_TAG_SCALE,
  );
  if (!texture) return key;
  const g = texture.getContext();
  const width = size.width * NAME_TAG_SCALE;
  const height = NAME_TAG.height * NAME_TAG_SCALE;
  const tail = (NAME_TAG.tailWidth * NAME_TAG_SCALE) / 2;
  g.fillStyle = `#${SELECTION_MARKER_COLOR.toString(16).padStart(6, '0')}`;
  g.beginPath();
  g.roundRect(0, 0, width, height, height / 2);
  g.fill();
  g.beginPath();
  g.moveTo(width / 2 - tail, height - 1);
  g.lineTo(width / 2 + tail, height - 1);
  g.lineTo(width / 2, size.height * NAME_TAG_SCALE);
  g.closePath();
  g.fill();
  g.fillStyle = NAME_TAG_TEXT_COLOR;
  g.font = NAME_TAG_FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, width / 2, height / 2 + 1);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
}

export type CharacterSprite = {
  body: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  shadowReady: boolean;
  ring: Phaser.GameObjects.Graphics;
  // Dymek z imieniem: tekstura ustawiana przy pierwszym zaznaczeniu.
  nameTag: Phaser.GameObjects.Image;
  nameTagReady: boolean;
  personId: PersonId;
  ready: boolean;
  // Atlas palenia: 'none' — jeszcze nieproszony; 'loading' — w toku (albo osoba nie ma atlasu).
  smoke: 'none' | 'loading' | 'ready';
  facing: Facing;
  // Narysowany znacznik pod stopami — Graphics przerysowujemy tylko przy jego zmianie.
  ringKey: string;
  // Tweeny znacznika zaznaczenia — działają tylko dla zaznaczonej postaci.
  markerTweens: Phaser.Tweens.Tween[];
  // Bieżące uniesienie dymka (animowane tweenem, stosowane przy ustawianiu pozycji).
  lift: { value: number };
  destroy(): void;
};

export function createCharacterSprite(scene: Phaser.Scene, personId: PersonId): CharacterSprite {
  const ring = scene.add.graphics().setDepth(CHARACTER_RING_DEPTH);
  const shadow = scene.add
    .image(0, 0, '__MISSING')
    .setOrigin(
      CHARACTER_SHADOW.anchorX / CHARACTER_SHADOW.width,
      CHARACTER_SHADOW.anchorY / CHARACTER_SHADOW.height,
    )
    .setScale(1 / CHARACTER_SHADOW.scale)
    .setDepth(CHARACTER_SHADOW_DEPTH)
    .setVisible(false);
  const body = scene.add
    .sprite(0, 0, '__MISSING')
    .setOrigin(SHEET.anchorX / SHEET.frameWidth, SHEET.anchorY / SHEET.frameHeight)
    .setScale(1 / SHEET.scale)
    .setVisible(false);
  const nameTag = scene.add
    .image(0, 0, '__MISSING')
    .setOrigin(0.5, 1)
    .setScale(1 / NAME_TAG_SCALE)
    .setDepth(NAME_TAG_DEPTH)
    .setVisible(false);
  const sprite: CharacterSprite = {
    body,
    shadow,
    shadowReady: false,
    ring,
    nameTag,
    nameTagReady: false,
    personId,
    ready: false,
    smoke: 'none',
    facing: 'px',
    ringKey: '',
    markerTweens: [],
    lift: { value: 0 },
    destroy() {
      stopMarkerTweens(sprite);
      body.destroy();
      shadow.destroy();
      ring.destroy();
      nameTag.destroy();
    },
  };
  ensureShadowTexture(scene, () => {
    if (!shadow.active) return;
    shadow.setTexture(SHADOW_TEXTURE);
    sprite.shadowReady = true;
  });
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
      value: { from: 0, to: NAME_TAG_LIFT },
      duration: MARKER_PULSE_MS / 2,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    }),
  ];
}

function requestSmokeTexture(sprite: CharacterSprite): void {
  sprite.smoke = 'loading';
  ensureSmokeTexture(sprite.body.scene, sprite.personId, () => {
    if (sprite.body.active) sprite.smoke = 'ready';
  });
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
  if (pose.alpha !== sprite.body.alpha) sprite.body.setAlpha(pose.alpha);
  sprite.shadow.setPosition(screen.x, screen.y);
  if (pose.alpha !== sprite.shadow.alpha) sprite.shadow.setAlpha(pose.alpha);
  sprite.shadow.setVisible(
    sprite.ready && sprite.shadowReady && pose.alpha > 0 && castsFloorShadow(pose.kind),
  );
  if (pose.kind === 'smoke' && sprite.smoke === 'none') requestSmokeTexture(sprite);
  if (sprite.ready) {
    const kind = shownPoseKind(pose.kind, sprite.smoke === 'ready');
    const key = animKey(sprite.personId, kind, sprite.facing);
    if (sprite.body.anims.currentAnim?.key !== key) {
      // Ramka palenia ma inny rozmiar i kotwicę: origin zmienia się w tej samej klatce co
      // animacja, więc stopy nie przeskakują.
      const origin = sheetOrigin(kind);
      sprite.body.setOrigin(origin.x, origin.y).play(key);
    }
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
      sprite.ring.lineStyle(3, SELECTION_MARKER_COLOR, 1).strokeEllipse(0, 0, 36, 17);
    }
    if (selected && !wasSelected) startMarkerTweens(sprite);
    if (!selected && wasSelected) stopMarkerTweens(sprite);
  }
  // Niewidoczna za ścianą: bez znaczników, które zdradzałyby ją przez ścianę.
  const visible = pose.alpha > 0;
  sprite.ring.setVisible(visible && (warning || selected));
  sprite.ring.setPosition(screen.x, screen.y);
  if (selected && !sprite.nameTagReady) {
    sprite.nameTag.setTexture(
      ensureNameTagTexture(sprite.nameTag.scene, firstNameOf(sprite.personId)),
    );
    sprite.nameTagReady = true;
  }
  sprite.nameTag.setVisible(visible && selected);
  if (selected) {
    sprite.nameTag.setPosition(
      screen.x,
      screen.y -
        SHEET.anchorY / SHEET.scale -
        NAME_TAG_GAP +
        (SEATED_POSES.includes(pose.kind) ? SEATED_NAME_TAG_DROP : 0) -
        sprite.lift.value,
    );
  }
}
