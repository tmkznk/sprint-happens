import * as Phaser from 'phaser';
import type { Engine } from '../simulation/engine';
import { OfficeScene, type OfficeSceneOptions, type Presentation } from './OfficeScene';

// Gra zarządcza nie potrzebuje 60–120 klatek na sekundę: limit klatek i karta graficzna
// w trybie oszczędnym ograniczają nagrzewanie telefonu i zużycie baterii. Symulacja nie zależy
// od klatek sceny (osobny akumulator czasu, T:TIME-T05).
export const RENDER_FPS_LIMIT = 30;

export function createOfficeGame(
  parent: HTMLElement,
  engine: Engine,
  presentation: Presentation,
  options: OfficeSceneOptions,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#d5e2da',
    pixelArt: true,
    fps: { limit: RENDER_FPS_LIMIT },
    render: { powerPreference: 'low-power' },
    scale: { mode: Phaser.Scale.RESIZE },
    // Dwa wskaźniki dotykowe dla gestu przybliżania (UX-02).
    input: { activePointers: 2 },
    scene: [new OfficeScene(engine, presentation, options)],
  });
}
