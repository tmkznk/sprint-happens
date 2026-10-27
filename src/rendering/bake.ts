import * as Phaser from 'phaser';
import type { Bounds } from './cameraMath';

// Statyczna geometria (podłoga, ściany) rysowana raz do tekstury. Phaser w każdej klatce na nowo
// trianguluje każdy wielokąt obiektu Graphics — przy setkach pól i ścian był to główny koszt CPU
// sceny na telefonie. Wypieczone kawałki to zwykłe obrazki z jednego atlasu, każdy ze swoją
// głębokością, więc okluzja postaci za ścianami działa jak wcześniej.
export type BakedPiece = {
  // Prostokąt kawałka na ekranie świata (z zapasem na wysokość ścian).
  bounds: Bounds;
  depth: number;
  draw(graphics: Phaser.GameObjects.Graphics): void;
};

// T:ART-06 — podwójna rozdzielczość, aby krawędzie nie rozmywały się przy przybliżeniu.
const RESOLUTION = 2;
const PADDING = 2;
const MAX_ROW_WIDTH = 2048;

type Placement = { piece: BakedPiece; x: number; y: number; width: number; height: number };

// Prosty pakowacz półkowy: kawałki od najwyższego, wierszami do MAX_ROW_WIDTH.
function pack(pieces: readonly BakedPiece[]): {
  placements: Placement[];
  width: number;
  height: number;
} {
  const sized = pieces.map((piece) => ({
    piece,
    width: Math.ceil((piece.bounds.right - piece.bounds.left) * RESOLUTION) + 2 * PADDING,
    height: Math.ceil((piece.bounds.bottom - piece.bounds.top) * RESOLUTION) + 2 * PADDING,
  }));
  const rowWidth = Math.max(MAX_ROW_WIDTH, ...sized.map((s) => s.width));
  const placements: Placement[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const item of [...sized].sort((a, b) => b.height - a.height)) {
    if (x + item.width > rowWidth) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    placements.push({ ...item, x, y });
    x += item.width;
    rowHeight = Math.max(rowHeight, item.height);
  }
  const width = Math.max(1, ...placements.map((p) => p.x + p.width));
  return { placements, width, height: Math.max(1, y + rowHeight) };
}

// Wypieka kawałki do tekstury `key` i dodaje je do sceny jako obrazki. Po odzyskaniu kontekstu
// WebGL (telefon zwalnia pamięć karty w tle) tekstura jest rysowana ponownie.
export function bakePieces(
  scene: Phaser.Scene,
  key: string,
  pieces: readonly BakedPiece[],
): Phaser.GameObjects.Image[] {
  const { placements, width, height } = pack(pieces);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.addDynamicTexture(key, width, height);
  if (!texture) return [];
  // Przed malowaniem: zmiana filtra tworzy teksturę WebGL od nowa i kasuje jej zawartość.
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

  const paint = () => {
    texture.clear();
    const drawn: Phaser.GameObjects.Graphics[] = [];
    for (const { piece, x, y } of placements) {
      const graphics = scene.make.graphics({}, false).setScale(RESOLUTION);
      piece.draw(graphics);
      texture.draw(
        graphics,
        x + PADDING - piece.bounds.left * RESOLUTION,
        y + PADDING - piece.bounds.top * RESOLUTION,
      );
      drawn.push(graphics);
    }
    texture.render();
    for (const graphics of drawn) graphics.destroy();
  };
  paint();

  const renderer = scene.game.renderer;
  renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, paint);
  const detach = () => renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, paint);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, detach);
  scene.events.once(Phaser.Scenes.Events.DESTROY, detach);

  return placements.map(({ piece, x, y, width: w, height: h }, index) => {
    const frame = `piece-${index}`;
    texture.add(frame, 0, x, y, w, h);
    return scene.add
      .image(
        piece.bounds.left - PADDING / RESOLUTION,
        piece.bounds.top - PADDING / RESOLUTION,
        key,
        frame,
      )
      .setOrigin(0, 0)
      .setScale(1 / RESOLUTION)
      .setDepth(piece.depth);
  });
}
