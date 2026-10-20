import * as Phaser from 'phaser';
import type { Engine } from '../simulation/engine';
import { OfficeScene, type OfficeSceneOptions } from './OfficeScene';

export function createOfficeGame(
  parent: HTMLElement,
  engine: Engine,
  options: OfficeSceneOptions,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1d1f2b',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [new OfficeScene(engine, options)],
  });
}
