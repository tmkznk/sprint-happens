import * as Phaser from 'phaser';

class OfficeScene extends Phaser.Scene {
  constructor() {
    super('office');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Sprint Happens!', { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);
  }
}

export function createOfficeGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1d1f2b',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [OfficeScene],
  });
}
