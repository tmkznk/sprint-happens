import * as Phaser from 'phaser';
import type { SelectionStore } from '../application/selection';
import type { Engine } from '../simulation/engine';
import { OfficeScene, type OfficeSceneOptions } from './OfficeScene';

export function createOfficeGame(
  parent: HTMLElement,
  engine: Engine,
  selection: SelectionStore,
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
    scene: [new OfficeScene(engine, selection, options)],
  });
}
