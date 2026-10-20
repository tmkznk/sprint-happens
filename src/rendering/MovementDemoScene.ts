import * as Phaser from 'phaser';
import { cellKey } from '../world/movement/grid';
import { stepMovement, type MovementState } from '../world/movement/movement';
import type { Scenario } from '../world/movement/scenarios';
import type { Bounds } from './cameraMath';
import {
  createAgentSprite,
  displayPosition,
  placeAgentSprite,
  type AgentSprite,
} from './agentSprites';
import { drawPrism, fillPolygon, rectCorners } from './draw';
import { attachOfficeCamera } from './officeCamera';
import { ACTOR_HEIGHT, MARKER_COLOR, WALL_COLOR } from './placeholderStyle';
import { depthOfFootprint, depthOfPoint, gridToScreen } from './projection';

// Pokaz scenariuszy ruchu z SH-003 (`?scene=movement&scenario=<nazwa>`). Ma własny zegar
// stałokrokowy — to narzędzie prototypu, nie stan gry.
const STEP_MS = 100;
const RESTART_AFTER_STEPS = 20;
const WALL_HEIGHT = 20;
const FLOOR_COLOR = 0x8a7a5c;

export class MovementDemoScene extends Phaser.Scene {
  private readonly scenario: Scenario;
  private state: MovementState;
  private accumulatorMs = 0;
  private stepsSinceFinish = 0;
  private readonly views = new Map<string, AgentSprite>();

  constructor(scenario: Scenario) {
    super('movement-demo');
    this.scenario = scenario;
    this.state = scenario.initial;
  }

  create(): void {
    this.drawMap();
    this.scenario.initial.agents.forEach((agent, index) => {
      this.add
        .text(0, 0, agent.id, { fontSize: '14px', color: '#000000', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setName(`label-${agent.id}`);
      this.views.set(agent.id, createAgentSprite(this, index));
    });

    const { width, height } = this.scenario.env.grid.size;
    const [top, right, bottom, left] = rectCorners({ x: 0, y: 0, width, height });
    const bounds: Bounds = {
      left: left?.x ?? 0,
      right: right?.x ?? 0,
      top: (top?.y ?? 0) - WALL_HEIGHT,
      bottom: bottom?.y ?? 0,
    };
    const detach = attachOfficeCamera(this, { bounds, onTap: () => undefined });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, detach);
    this.events.once(Phaser.Scenes.Events.DESTROY, detach);
    this.render(0);
  }

  override update(_time: number, deltaMs: number): void {
    this.accumulatorMs += Math.min(deltaMs, 250);
    while (this.accumulatorMs >= STEP_MS) {
      this.accumulatorMs -= STEP_MS;
      if (this.isFinished()) {
        if (++this.stepsSinceFinish >= RESTART_AFTER_STEPS) {
          this.state = this.scenario.initial;
          this.stepsSinceFinish = 0;
        }
      } else {
        this.state = stepMovement(this.state, this.scenario.env);
      }
    }
    this.render(this.accumulatorMs / STEP_MS);
  }

  private isFinished(): boolean {
    const { agents, step } = this.state;
    return (
      step >= this.scenario.maxSteps ||
      agents.every((a) => !a.move && (a.status === 'arrived' || a.status === 'deadlocked'))
    );
  }

  private render(alpha: number): void {
    for (const agent of this.state.agents) {
      const view = this.views.get(agent.id);
      if (!view) continue;
      placeAgentSprite(view, agent, alpha, this.scenario.env.config.stepsPerCell);
      const position = displayPosition(agent, alpha, this.scenario.env.config.stepsPerCell);
      const screen = gridToScreen(position);
      const depth = depthOfPoint(position);
      const label = this.children.getByName(`label-${agent.id}`) as Phaser.GameObjects.Text | null;
      label?.setPosition(screen.x, screen.y - ACTOR_HEIGHT / 2).setDepth(depth + 0.001);
    }
  }

  private drawMap(): void {
    const { grid, destinations } = this.scenario.env;
    const floor = this.add.graphics().setDepth(-1000);
    const destinationKeys = new Set(destinations.map((d) => cellKey(d.cell)));
    for (let y = 0; y < grid.size.height; y++) {
      for (let x = 0; x < grid.size.width; x++) {
        const rect = { x, y, width: 1, height: 1 };
        if (grid.passable({ x, y })) {
          const color = destinationKeys.has(cellKey({ x, y })) ? MARKER_COLOR : FLOOR_COLOR;
          fillPolygon(floor, color, rectCorners(rect));
          floor.lineStyle(1, 0x6b5a3e, 1).strokePoints(
            rectCorners(rect).map((p) => new Phaser.Math.Vector2(p.x, p.y)),
            true,
          );
        } else {
          const wall = this.add.graphics().setDepth(depthOfFootprint(rect, rect));
          drawPrism(wall, rect, WALL_HEIGHT, WALL_COLOR);
        }
      }
    }
  }
}
