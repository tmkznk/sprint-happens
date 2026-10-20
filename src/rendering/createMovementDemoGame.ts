import * as Phaser from 'phaser';
import type { Scenario } from '../world/movement/scenarios';
import { MovementDemoScene } from './MovementDemoScene';

export function createMovementDemoGame(parent: HTMLElement, scenario: Scenario): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1d1f2b',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE },
    input: { activePointers: 2 },
    scene: [new MovementDemoScene(scenario)],
  });
}
