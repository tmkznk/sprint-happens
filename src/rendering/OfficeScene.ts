import * as Phaser from 'phaser';
import type { FurnitureType } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import type { GameState } from '../domain/state';
import type { Engine } from '../simulation/engine';
import { footprintSize, interactionCells } from '../world/geometry';
import { cellKindAt, OFFICE_LAYOUT, roomAt, type Rect, type RoomId } from '../world/officeLayout';
import { expandWaypoints, OCCLUSION_WAYPOINTS } from './occlusionPath';
import {
  cellCenter,
  depthOfFootprint,
  depthOfPoint,
  gridToScreen,
  interpolate,
  type ScreenPoint,
} from './projection';

export type OfficeSceneOptions = {
  // Scena testowa okluzji: postać na stałej trasie i znaczniki punktów interakcji (SH-002).
  occlusionTest: boolean;
};

// Zastępcze kolory i wysokości (px źródłowe) do czasu właściwych assetów (SH-035, SH-036).
const FLOOR_COLORS: Record<RoomId, number> = { main: 0x8a7a5c, small: 0x7c8a5c, social: 0x5c7a8a };
const DOOR_COLOR = 0x6b5a3e;
const WALL_COLOR = 0xc9c3b6;
const WINDOW_COLOR = 0x9fd3ff;
const FURNITURE_STYLE: Record<FurnitureType, { color: number; height: number }> = {
  desk: { color: 0xb07a45, height: 22 },
  sofa: { color: 0x6a4fa3, height: 18 },
  coffeeMachine: { color: 0x3d3d3d, height: 34 },
};
const BACK_WALL_HEIGHT = 48;
const FRONT_WALL_HEIGHT = 12;
// T:ART-02 (R): stojąca postać ma około 48 px wysokości.
const ACTOR_HEIGHT = 48;
const ACTOR_COLOR = 0xf2c14e;
const MARKER_COLOR = 0x55ff99;
const FLOOR_DEPTH = -1000;

const TEST_STEP_MS = 100;
const TEST_STEPS_PER_CELL = 4;

export class OfficeScene extends Phaser.Scene {
  private readonly engine: Engine;
  private readonly options: OfficeSceneOptions;
  private furnitureGraphics: Phaser.GameObjects.Graphics[] = [];
  private renderedFurniture: GameState['world']['furniture'] | null = null;
  private actor: Phaser.GameObjects.Graphics | null = null;
  private actorPath: GridPoint[] = [];
  private actorStep = 0;
  private actorAccumulatorMs = 0;

  constructor(engine: Engine, options: OfficeSceneOptions) {
    super('office');
    this.engine = engine;
    this.options = options;
  }

  create(): void {
    this.drawFloor();
    this.drawWalls();
    this.syncFurniture(this.engine.getState());
    const unsubscribe = this.engine.subscribe((state) => this.syncFurniture(state));

    if (this.options.occlusionTest) this.createTestActor();

    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);

    // T:VIEW-05 — scena sprząta subskrypcje przy zamknięciu.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    });
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.actor) return;
    this.actorAccumulatorMs += deltaMs;
    while (this.actorAccumulatorMs >= TEST_STEP_MS) {
      this.actorAccumulatorMs -= TEST_STEP_MS;
      this.actorStep++;
    }
    const cellIndex =
      Math.floor(this.actorStep / TEST_STEPS_PER_CELL) % (this.actorPath.length - 1);
    const progress =
      ((this.actorStep % TEST_STEPS_PER_CELL) + this.actorAccumulatorMs / TEST_STEP_MS) /
      TEST_STEPS_PER_CELL;
    const from = this.actorPath[cellIndex];
    const to = this.actorPath[cellIndex + 1];
    if (!from || !to) return;

    const position = interpolate(cellCenter(from), cellCenter(to), progress);
    const screen = gridToScreen(position);
    this.actor.setPosition(screen.x, screen.y).setDepth(depthOfPoint(position));
  }

  private drawFloor(): void {
    const graphics = this.add.graphics().setDepth(FLOOR_DEPTH);
    const { width, height } = OFFICE_LAYOUT.size;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = { x, y };
        const kind = cellKindAt(OFFICE_LAYOUT, cell);
        if (kind === 'wall' || kind === null) continue;
        const room = roomAt(OFFICE_LAYOUT, cell);
        const color = kind === 'door' || !room ? DOOR_COLOR : FLOOR_COLORS[room.id];
        const corners = rectCorners({ ...cell, width: 1, height: 1 });
        fillPolygon(graphics, color, corners);
        graphics.lineStyle(1, shade(color, 0.8), 1);
        graphics.strokePoints(toVectors(corners), true);
      }
    }
  }

  private drawWalls(): void {
    const { width, height } = OFFICE_LAYOUT.size;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cellKindAt(OFFICE_LAYOUT, { x, y }) !== 'wall') continue;
        // OFF-08 (O): ściany od strony kamery są obniżone, aby nie zasłaniać wnętrza.
        const wallHeight = x === 0 || y === 0 ? BACK_WALL_HEIGHT : FRONT_WALL_HEIGHT;
        const rect = { x, y, width: 1, height: 1 };
        const graphics = this.add.graphics().setDepth(depthOfFootprint(rect, rect));
        drawPrism(graphics, rect, wallHeight, WALL_COLOR);
        if (OFFICE_LAYOUT.windows.some((window) => window.x === x && window.y === y)) {
          drawWindow(graphics, rect, wallHeight);
        }
      }
    }
  }

  private syncFurniture(state: GameState): void {
    if (state.world.furniture === this.renderedFurniture) return;
    this.renderedFurniture = state.world.furniture;
    for (const graphics of this.furnitureGraphics) graphics.destroy();
    this.furnitureGraphics = [];

    for (const furniture of Object.values(state.world.furniture)) {
      const rect = { ...furniture.origin, ...footprintSize(furniture) };
      const style = FURNITURE_STYLE[furniture.type];
      const graphics = this.add.graphics().setDepth(depthOfFootprint(rect, rect));
      drawPrism(graphics, rect, style.height, style.color);
      this.furnitureGraphics.push(graphics);

      if (this.options.occlusionTest) {
        const markers = this.add.graphics().setDepth(FLOOR_DEPTH + 1);
        for (const point of interactionCells(furniture)) {
          const inset = { x: point.x + 0.3, y: point.y + 0.3, width: 0.4, height: 0.4 };
          fillPolygon(markers, MARKER_COLOR, rectCorners(inset));
        }
        this.furnitureGraphics.push(markers);
      }
    }
  }

  private createTestActor(): void {
    this.actorPath = expandWaypoints(OCCLUSION_WAYPOINTS);
    const actor = this.add.graphics();
    actor.fillStyle(0x000000, 0.3).fillEllipse(0, 0, 24, 10);
    actor.fillStyle(ACTOR_COLOR, 1).fillRect(-8, -ACTOR_HEIGHT + 8, 16, ACTOR_HEIGHT - 12);
    actor.fillStyle(0xf5d6b4, 1).fillCircle(0, -ACTOR_HEIGHT + 7, 7);
    this.actor = actor;
  }

  private fitCamera(): void {
    const camera = this.cameras.main;
    const { width, height } = OFFICE_LAYOUT.size;
    const corners = rectCorners({ x: 0, y: 0, width, height });
    const [top, right, bottom, left] = corners;
    if (!top || !right || !bottom || !left) return;
    const officeWidth = right.x - left.x;
    const officeHeight = bottom.y - top.y + BACK_WALL_HEIGHT;
    // UX-03 (Z): stały kąt kamery; dopasowanie skali bez obrotu świata. Gesty — SH-010.
    camera.setZoom(
      Math.min(this.scale.width / officeWidth, this.scale.height / officeHeight) * 0.95,
    );
    camera.centerOn((left.x + right.x) / 2, (top.y - BACK_WALL_HEIGHT + bottom.y) / 2);
  }
}

// Narożniki prostokąta siatki na ekranie: górny, prawy, dolny, lewy.
function rectCorners(rect: Rect): ScreenPoint[] {
  return [
    gridToScreen({ x: rect.x, y: rect.y }),
    gridToScreen({ x: rect.x + rect.width, y: rect.y }),
    gridToScreen({ x: rect.x + rect.width, y: rect.y + rect.height }),
    gridToScreen({ x: rect.x, y: rect.y + rect.height }),
  ];
}

function drawPrism(
  graphics: Phaser.GameObjects.Graphics,
  rect: Rect,
  height: number,
  color: number,
): void {
  const [top, right, bottom, left] = rectCorners(rect);
  if (!top || !right || !bottom || !left) return;
  const up = (point: ScreenPoint) => ({ x: point.x, y: point.y - height });
  fillPolygon(graphics, shade(color, 0.75), [left, bottom, up(bottom), up(left)]);
  fillPolygon(graphics, shade(color, 0.6), [bottom, right, up(right), up(bottom)]);
  fillPolygon(graphics, color, [up(top), up(right), up(bottom), up(left)]);
}

// Okno na ścianie zwróconej do pokoju: lewa ściana bryły, gdy pokój jest „pod” nią (y+1),
// prawa, gdy pokój jest po jej prawej stronie (x+1).
function drawWindow(graphics: Phaser.GameObjects.Graphics, rect: Rect, height: number): void {
  const [, right, bottom, left] = rectCorners(rect);
  if (!right || !bottom || !left) return;
  const facesDown = roomAt(OFFICE_LAYOUT, { x: rect.x, y: rect.y + 1 }) !== undefined;
  const [start, end] = facesDown ? [left, bottom] : [bottom, right];
  const along = (t: number, lift: number) => ({
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t - height * lift,
  });
  fillPolygon(graphics, WINDOW_COLOR, [
    along(0.25, 0.35),
    along(0.75, 0.35),
    along(0.75, 0.8),
    along(0.25, 0.8),
  ]);
}

function fillPolygon(
  graphics: Phaser.GameObjects.Graphics,
  color: number,
  points: ScreenPoint[],
): void {
  graphics.fillStyle(color, 1);
  graphics.fillPoints(toVectors(points), true);
}

function toVectors(points: ScreenPoint[]): Phaser.Math.Vector2[] {
  return points.map((point) => new Phaser.Math.Vector2(point.x, point.y));
}

function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
