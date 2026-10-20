import * as Phaser from 'phaser';
import type { Engine } from '../simulation/engine';
import { OfficeScene, type OfficeSceneOptions, type Presentation } from './OfficeScene';

export function createOfficeGame(
  parent: HTMLElement,
  engine: Engine,
  presentation: Presentation,
  options: OfficeSceneOptions,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1d1f2b',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE },
    // Dwa wskaźniki dotykowe dla gestu przybliżania (UX-02).
    input: { activePointers: 2 },
    scene: [new OfficeScene(engine, presentation, options)],
  });
}
