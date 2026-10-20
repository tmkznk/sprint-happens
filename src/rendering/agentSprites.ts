import * as Phaser from 'phaser';
import type { AgentStatus, ReadonlyAgent } from '../domain/movement';
import { ACTOR_HEIGHT, SELECTION_COLOR } from './placeholderStyle';
import { displayPosition } from './agentPosition';
import { depthOfPoint, gridToScreen } from './projection';

export { displayPosition };

// Zastępcze sylwetki postaci (do czasu assetów z SH-036) i ich pozycja wyświetlana.
const AGENT_COLORS = [0xf2c14e, 0x4ec9f2, 0xf24e9a, 0x9af24e, 0xc78bf2, 0xf2a14e];

export const STATUS_COLORS: Partial<Record<AgentStatus, number>> = {
  yielding: 0xff8c1a,
  waiting: 0x9a9a9a,
  queued: 0x4e7cf2,
  using: 0x3ddc84,
  deadlocked: 0xff3b3b,
  noRoute: 0xff3b3b,
};

export type AgentSprite = {
  body: Phaser.GameObjects.Graphics;
  ring: Phaser.GameObjects.Graphics;
  destroy(): void;
};

export function createAgentSprite(scene: Phaser.Scene, index: number): AgentSprite {
  const ring = scene.add.graphics();
  const body = scene.add.graphics();
  body.fillStyle(AGENT_COLORS[index % AGENT_COLORS.length] ?? 0xffffff, 1);
  body.fillRect(-8, -ACTOR_HEIGHT + 8, 16, ACTOR_HEIGHT - 12);
  body.fillStyle(0xf5d6b4, 1).fillCircle(0, -ACTOR_HEIGHT + 7, 7);
  return {
    body,
    ring,
    destroy() {
      body.destroy();
      ring.destroy();
    },
  };
}

export function placeAgentSprite(
  sprite: AgentSprite,
  agent: ReadonlyAgent,
  alpha: number,
  stepsPerCell: number,
  selected = false,
): void {
  const position = displayPosition(agent, alpha, stepsPerCell);
  const screen = gridToScreen(position);
  const depth = depthOfPoint(position);
  sprite.body.setPosition(screen.x, screen.y).setDepth(depth);
  const statusColor = STATUS_COLORS[agent.status];
  sprite.ring.clear();
  sprite.ring.fillStyle(statusColor ?? 0x000000, statusColor ? 0.9 : 0.3);
  sprite.ring.fillEllipse(0, 0, 30, 13);
  if (selected) sprite.ring.lineStyle(3, SELECTION_COLOR, 1).strokeEllipse(0, 0, 34, 16);
  sprite.ring.setPosition(screen.x, screen.y).setDepth(depth - 0.005);
}
