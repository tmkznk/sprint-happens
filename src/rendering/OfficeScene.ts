import * as Phaser from 'phaser';
import type { FrameClock } from '../application/gameLoop';
import type { Selection, SelectionStore } from '../application/selection';
import type { EmployeeId } from '../domain/employees';
import type { GridPoint } from '../domain/grid';
import type { GameState } from '../domain/state';
import type { Engine } from '../simulation/engine';
import { interactionCells } from '../world/geometry';
import { cellKindAt, OFFICE_LAYOUT, roomAt, type Rect } from '../world/officeLayout';
import { createAgentSprite, placeAgentSprite, type AgentSprite } from './agentSprites';
import type { Bounds } from './cameraMath';
import { drawPrism, fillPolygon, rectCorners, shade, toVectors } from './draw';
import { attachOfficeCamera } from './officeCamera';
import { expandWaypoints, OCCLUSION_WAYPOINTS } from './occlusionPath';
import { furnitureRect, pickAgent, pickFurniture, prismSilhouette } from './picking';
import {
  ACTOR_COLOR,
  ACTOR_HEIGHT,
  BACK_WALL_HEIGHT,
  DOOR_COLOR,
  FLOOR_COLORS,
  FRONT_WALL_HEIGHT,
  FURNITURE_STYLE,
  MARKER_COLOR,
  SELECTION_COLOR,
  WALL_COLOR,
  WINDOW_COLOR,
} from './placeholderStyle';
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

const FLOOR_DEPTH = -1000;

const TEST_STEP_MS = 100;
const TEST_STEPS_PER_CELL = 4;

export class OfficeScene extends Phaser.Scene {
  private readonly engine: Engine;
  private readonly selection: SelectionStore;
  private readonly frameClock: FrameClock;
  private readonly options: OfficeSceneOptions;
  private readonly agentSprites = new Map<string, AgentSprite>();
  private furnitureGraphics: Phaser.GameObjects.Graphics[] = [];
  private renderedFurniture: GameState['world']['furniture'] | null = null;
  private renderedSelection: Selection = null;
  private actor: Phaser.GameObjects.Graphics | null = null;
  private actorPath: GridPoint[] = [];
  private actorStep = 0;
  private actorAccumulatorMs = 0;

  constructor(
    engine: Engine,
    selection: SelectionStore,
    frameClock: FrameClock,
    options: OfficeSceneOptions,
  ) {
    super('office');
    this.engine = engine;
    this.selection = selection;
    this.frameClock = frameClock;
    this.options = options;
  }

  create(): void {
    this.drawFloor();
    this.drawWalls();
    this.syncFurniture();
    const unsubscribeEngine = this.engine.subscribe(() => this.syncFurniture());
    const unsubscribeSelection = this.selection.subscribe(() => this.syncFurniture());

    if (this.options.occlusionTest) this.createTestActor();

    const detachCamera = attachOfficeCamera(this, {
      bounds: officeBounds(),
      onTap: (world) => this.select(world),
    });

    // T:VIEW-05 — scena sprząta subskrypcje i listenery przy zamknięciu. Zniszczenie gry
    // (np. podwójny montaż w StrictMode) emituje DESTROY bez SHUTDOWN, więc obsługujemy oba.
    let cleanedUp = false;
    const cleanUp = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      unsubscribeEngine();
      unsubscribeSelection();
      detachCamera();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanUp);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanUp);
  }

  // UX-01 (Z): dotknięcie mebla otwiera panel szczegółów; dotknięcie pustego miejsca go zamyka.
  private select(world: ScreenPoint): void {
    const state = this.engine.getState();
    const agentId = pickAgent(
      world,
      state.world.movement.agents,
      this.frameClock.alpha,
      this.engine.config.movement.stepsPerCell,
    );
    const employee = agentId ? state.staff.employees[agentId as EmployeeId] : undefined;
    if (employee) {
      this.selection.set({ kind: 'employee', id: employee.id });
      return;
    }
    const id = pickFurniture(world, Object.values(state.world.furniture));
    this.selection.set(id ? { kind: 'furniture', id } : null);
  }

  override update(_time: number, deltaMs: number): void {
    this.renderAgents();
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

  // Postacie z silnika (SH-011, SH-012): scena tylko przedstawia pozycje logiczne
  // i interpoluje je wizualnie — nie przesuwa ich i nie zwalnia rezerwacji (T:TIME-T02).
  private renderAgents(): void {
    const { agents } = this.engine.getState().world.movement;
    const present = new Set<string>();
    agents.forEach((agent, index) => {
      present.add(agent.id);
      let sprite = this.agentSprites.get(agent.id);
      if (!sprite) {
        sprite = createAgentSprite(this, index);
        this.agentSprites.set(agent.id, sprite);
      }
      placeAgentSprite(
        sprite,
        agent,
        this.frameClock.alpha,
        this.engine.config.movement.stepsPerCell,
      );
    });
    for (const [id, sprite] of this.agentSprites) {
      if (present.has(id)) continue;
      sprite.destroy();
      this.agentSprites.delete(id);
    }
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

  private syncFurniture(): void {
    const { furniture: allFurniture } = this.engine.getState().world;
    const selection = this.selection.get();
    if (allFurniture === this.renderedFurniture && selection === this.renderedSelection) return;
    this.renderedFurniture = allFurniture;
    this.renderedSelection = selection;
    for (const graphics of this.furnitureGraphics) graphics.destroy();
    this.furnitureGraphics = [];

    for (const furniture of Object.values(allFurniture)) {
      const rect = furnitureRect(furniture);
      const style = FURNITURE_STYLE[furniture.type];
      const graphics = this.add.graphics().setDepth(depthOfFootprint(rect, rect));
      drawPrism(graphics, rect, style.height, style.color);
      if (selection?.kind === 'furniture' && selection.id === furniture.id) {
        graphics.lineStyle(3, SELECTION_COLOR, 1);
        graphics.strokePoints(toVectors(prismSilhouette(rect, style.height)), true);
      }
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
}

// Granice biura na ekranie świata, łącznie z wysokością tylnych ścian.
function officeBounds(): Bounds {
  const [top, right, bottom, left] = rectCorners({ x: 0, y: 0, ...OFFICE_LAYOUT.size });
  return {
    left: left?.x ?? 0,
    right: right?.x ?? 0,
    top: (top?.y ?? 0) - BACK_WALL_HEIGHT,
    bottom: bottom?.y ?? 0,
  };
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
