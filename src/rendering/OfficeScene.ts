import * as Phaser from 'phaser';
import {
  editCandidate,
  editProblem,
  type FurnitureEdit,
  type FurnitureEditStore,
} from '../application/furnitureEdit';
import type { FrameClock } from '../application/gameLoop';
import type { Selection, SelectionStore } from '../application/selection';
import type { EmployeeId } from '../domain/employees';
import type { GridPoint } from '../domain/grid';
import type { GameState } from '../domain/state';
import type { Engine } from '../simulation/engine';
import { interactionCells } from '../world/geometry';
import { cellKindAt, OFFICE_LAYOUT, roomAt, type Rect } from '../world/officeLayout';
import { rotatedSize } from '../world/geometry';
import { FURNITURE_CATALOG, type Furniture } from '../domain/furniture';
import { agentPose, deskChairDepth, type AgentPose } from './agentPose';
import {
  createCharacterAnimations,
  createCharacterSprite,
  placeCharacterSprite,
  preloadCharacters,
  type CharacterSprite,
} from './characterSprites';
import { personById } from '../domain/content/people';
import type { Bounds } from './cameraMath';
import { drawPrism, fillPolygon, rectCorners, shade, toVectors } from './draw';
import {
  furnitureSpriteKey,
  furnitureSpriteMeta,
  type FurnitureSpritePart,
} from './furnitureSpriteMeta';
import { doorThreshold, wallBands, wallFloorQuarters } from './wallGeometry';
import { attachOfficeCamera } from './officeCamera';
import { expandWaypoints, OCCLUSION_WAYPOINTS } from './occlusionPath';
import { furnitureRect, pickAgent, pickFurniture, prismSilhouette } from './picking';
import {
  ACTOR_COLOR,
  EDIT_INVALID_COLOR,
  EDIT_VALID_COLOR,
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
  WINDOW_FRAME_COLOR,
  WINDOW_SHINE_COLOR,
} from './placeholderStyle';
import {
  cellAtScreen,
  cellCenter,
  depthOfFootprint,
  depthOfPoint,
  gridToScreen,
  interpolate,
  type ScreenPoint,
} from './projection';

// Stan prezentacji współdzielony z panelami React (T:ARCH-02) — nie jest stanem gry.
export type Presentation = {
  selection: SelectionStore;
  edit: FurnitureEditStore;
  frameClock: FrameClock;
};

export type OfficeSceneOptions = {
  // Scena testowa okluzji: postać na stałej trasie i znaczniki punktów interakcji (SH-002).
  occlusionTest: boolean;
};

const FLOOR_DEPTH = -1000;

// Pre-renderowane meble (src/assets/furniture/<typ>-<obrót>.png) — adresy z paczki Vite.
const FURNITURE_TEXTURES = Object.entries(
  import.meta.glob<string>('../assets/furniture/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
).map(([path, url]) => [`furniture-${path.replace(/^.*\/(.+)\.png$/, '$1')}`, url] as const);

const TEST_STEP_MS = 100;
const TEST_STEPS_PER_CELL = 4;

export class OfficeScene extends Phaser.Scene {
  private readonly engine: Engine;
  private readonly selection: SelectionStore;
  private readonly edit: FurnitureEditStore;
  private readonly frameClock: FrameClock;
  private renderedEdit: FurnitureEdit | null = null;
  private readonly options: OfficeSceneOptions;
  private readonly agentSprites = new Map<string, CharacterSprite>();
  // Ostatnie pozy postaci — do wybierania dotykiem tam, gdzie postać jest narysowana.
  private agentPoses = new Map<string, AgentPose>();
  private furnitureGraphics: Phaser.GameObjects.GameObject[] = [];
  private renderedFurniture: GameState['world']['furniture'] | null = null;
  private renderedSelection: Selection = null;
  private actor: Phaser.GameObjects.Graphics | null = null;
  private actorPath: GridPoint[] = [];
  private actorStep = 0;
  private actorAccumulatorMs = 0;

  constructor(engine: Engine, presentation: Presentation, options: OfficeSceneOptions) {
    super('office');
    this.engine = engine;
    this.selection = presentation.selection;
    this.edit = presentation.edit;
    this.frameClock = presentation.frameClock;
    this.options = options;
  }

  preload(): void {
    for (const [key, url] of FURNITURE_TEXTURES) this.load.image(key, url);
    preloadCharacters(this);
  }

  create(): void {
    // Gra ma pixelArt (filtr najbliższego sąsiada); pre-render 3D skalujemy płynnie.
    for (const [key] of FURNITURE_TEXTURES) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    createCharacterAnimations(this);
    this.drawFloor();
    this.drawWalls();
    this.syncFurniture();
    const unsubscribeEngine = this.engine.subscribe(() => this.syncFurniture());
    const unsubscribeSelection = this.selection.subscribe(() => this.syncFurniture());
    const unsubscribeEdit = this.edit.subscribe(() => this.syncFurniture());

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
      unsubscribeEdit();
      detachCamera();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanUp);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanUp);
  }

  // UX-01 (Z): dotknięcie mebla otwiera panel szczegółów; dotknięcie pustego miejsca go zamyka.
  private select(world: ScreenPoint): void {
    // UX-04: w trybie „Urządź” dotknięcie przestawia podgląd mebla zamiast wybierać obiekty.
    const edit = this.edit.get();
    if (edit) {
      const candidate = editCandidate(this.engine.getState(), edit);
      if (!candidate) return;
      const size = rotatedSize(FURNITURE_CATALOG[candidate.type].footprint, edit.rotation);
      const cell = cellAtScreen(world);
      this.edit.set({
        ...edit,
        origin: {
          x: cell.x - Math.floor((size.width - 1) / 2),
          y: cell.y - Math.floor((size.height - 1) / 2),
        },
      });
      return;
    }
    const state = this.engine.getState();
    const agentId = pickAgent(
      world,
      [...this.agentPoses].map(([id, pose]) => ({
        id,
        position: pose.position,
        depth: pose.depth,
      })),
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
    const state = this.engine.getState();
    const selection = this.selection.get();
    const poses = new Map<string, AgentPose>();
    for (const agent of state.world.movement.agents) {
      let sprite = this.agentSprites.get(agent.id);
      if (!sprite) {
        const employee = state.staff.employees[agent.id as EmployeeId];
        const look = (employee && personById(employee.personId)?.look) ?? 'male-a';
        sprite = createCharacterSprite(this, look);
        this.agentSprites.set(agent.id, sprite);
      }
      const pose = agentPose(state, agent, this.frameClock.alpha, this.engine.config);
      poses.set(agent.id, pose);
      const selected = selection?.kind === 'employee' && selection.id === agent.id;
      placeCharacterSprite(sprite, pose, agent.status, state.mission.speed, selected);
    }
    for (const [id, sprite] of this.agentSprites) {
      if (poses.has(id)) continue;
      sprite.destroy();
      this.agentSprites.delete(id);
    }
    this.agentPoses = poses;
  }

  private drawFloor(): void {
    const graphics = this.add.graphics().setDepth(FLOOR_DEPTH);
    const { width, height } = OFFICE_LAYOUT.size;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = { x, y };
        const kind = cellKindAt(OFFICE_LAYOUT, cell);
        if (kind !== 'floor') continue;
        const room = roomAt(OFFICE_LAYOUT, cell);
        const color = room ? FLOOR_COLORS[room.id] : DOOR_COLOR;
        const corners = rectCorners({ ...cell, width: 1, height: 1 });
        fillPolygon(graphics, color, corners);
        graphics.lineStyle(1, shade(color, 0.8), 1);
        graphics.strokePoints(toVectors(corners), true);
      }
    }
    // Pola ścian i drzwi: podłoga przyległych pokojów aż do cienkiej tafli; w drzwiach próg.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (const { rect, room } of wallFloorQuarters(OFFICE_LAYOUT, { x, y })) {
          fillPolygon(graphics, FLOOR_COLORS[room.id], rectCorners(rect));
        }
        const threshold = doorThreshold(OFFICE_LAYOUT, { x, y });
        if (threshold) fillPolygon(graphics, DOOR_COLOR, rectCorners(threshold));
      }
    }
  }

  private drawWalls(): void {
    const { width, height } = OFFICE_LAYOUT.size;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cellKindAt(OFFICE_LAYOUT, { x, y }) !== 'wall') continue;
        for (const { rect, axis, back } of wallBands(OFFICE_LAYOUT, { x, y })) {
          // OFF-08 (O): ściany od strony kamery są obniżone, aby nie zasłaniać wnętrza.
          const wallHeight = back ? BACK_WALL_HEIGHT : FRONT_WALL_HEIGHT;
          const graphics = this.add.graphics().setDepth(depthOfFootprint(rect, rect));
          drawPrism(graphics, rect, wallHeight, WALL_COLOR);
          // Okno (dwa pola) rysowane częściami razem z taflą pola, na którym leży — ta sama
          // głębokość co ściana, więc postać przy ścianie zawsze jest przed oknem.
          if (back) {
            for (const span of windowSpans()) {
              const part = spanPart(span, { x, y }, axis);
              if (part) drawWindow(graphics, span.rect, BACK_WALL_HEIGHT, span.axis, part);
            }
          }
        }
      }
    }
  }

  private syncFurniture(): void {
    const state = this.engine.getState();
    const { furniture: allFurniture } = state.world;
    const selection = this.selection.get();
    const edit = this.edit.get();
    if (
      allFurniture === this.renderedFurniture &&
      selection === this.renderedSelection &&
      edit === this.renderedEdit
    ) {
      return;
    }
    this.renderedFurniture = allFurniture;
    this.renderedSelection = selection;
    this.renderedEdit = edit;
    for (const graphics of this.furnitureGraphics) graphics.destroy();
    this.furnitureGraphics = [];

    for (const furniture of Object.values(allFurniture)) {
      const rect = furnitureRect(furniture);
      const style = FURNITURE_STYLE[furniture.type];
      const images = this.addFurnitureImages(furniture);
      // Edytowany mebel zostaje w starym miejscu jako cień — anulowanie przywraca ten stan.
      if (edit?.mode === 'move' && edit.furnitureId === furniture.id) {
        for (const image of images) image.setAlpha(0.3);
      }
      this.furnitureGraphics.push(...images);
      if (!edit && selection?.kind === 'furniture' && selection.id === furniture.id) {
        const outline = this.add.graphics().setDepth(depthOfFootprint(rect, rect) + 0.001);
        outline.lineStyle(3, SELECTION_COLOR, 1);
        outline.strokePoints(toVectors(prismSilhouette(rect, style.height)), true);
        this.furnitureGraphics.push(outline);
      }

      if (this.options.occlusionTest) {
        const markers = this.add.graphics().setDepth(FLOOR_DEPTH + 1);
        for (const point of interactionCells(furniture)) {
          const inset = { x: point.x + 0.3, y: point.y + 0.3, width: 0.4, height: 0.4 };
          fillPolygon(markers, MARKER_COLOR, rectCorners(inset));
        }
        this.furnitureGraphics.push(markers);
      }
    }
    if (edit) this.drawEditPreview(edit);
  }

  // Podgląd ustawienia: zielony — dozwolone, czerwony — odrzucone (powód pokazuje panel).
  private drawEditPreview(edit: FurnitureEdit): void {
    const state = this.engine.getState();
    const candidate = editCandidate(state, edit);
    if (!candidate) return;
    const valid = editProblem(state, this.engine.config, edit) === null;
    const rect = furnitureRect(candidate);
    // Kolor pól pod meblem mówi, czy ustawienie jest dozwolone; sam mebel półprzezroczysty.
    const ghost = this.addFurnitureImages(candidate);
    for (const image of ghost) {
      image.setDepth(image.depth + 0.02).setAlpha(0.8);
      if (!valid) image.setTint(0xff9a9a);
    }
    const markers = this.add.graphics().setDepth(FLOOR_DEPTH + 1);
    markers.fillStyle(valid ? EDIT_VALID_COLOR : EDIT_INVALID_COLOR, 0.45);
    markers.fillPoints(toVectors(rectCorners(rect)), true);
    for (const point of interactionCells(candidate)) {
      const inset = { x: point.x + 0.3, y: point.y + 0.3, width: 0.4, height: 0.4 };
      fillPolygon(markers, MARKER_COLOR, rectCorners(inset));
    }
    this.furnitureGraphics.push(...ghost, markers);
  }

  // Kotwica obrazka = narożnik (0,0) footprintu; obrazek ma podwójną rozdzielczość. Biurko ma
  // osobny obrazek krzesła z głębokością siedziska — siedząca postać trafia między krzesło a blat.
  private addFurnitureImages(furniture: Furniture): Phaser.GameObjects.Image[] {
    const rect = furnitureRect(furniture);
    const corner = gridToScreen({ x: rect.x, y: rect.y });
    const image = (part: FurnitureSpritePart, depth: number) => {
      const sprite = furnitureSpriteMeta(part, furniture.rotation);
      return this.add
        .image(corner.x, corner.y, furnitureSpriteKey(part, furniture.rotation))
        .setOrigin(sprite.anchorX / sprite.width, sprite.anchorY / sprite.height)
        .setScale(1 / sprite.scale)
        .setDepth(depth);
    };
    const images = [image(furniture.type, depthOfFootprint(rect, rect))];
    if (furniture.type === 'desk') images.push(image('deskChair', deskChairDepth(furniture)));
    return images;
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
function drawWindow(
  graphics: Phaser.GameObjects.Graphics,
  rect: Rect,
  height: number,
  axis: 'x' | 'y',
  range: [number, number] = [0, 1],
): void {
  const [, right, bottom, left] = rectCorners(rect);
  if (!right || !bottom || !left) return;
  // Tafla wzdłuż X ma pokój „pod” sobą (lewa ściana bryły), wzdłuż Y — po prawej.
  const [start, end] = axis === 'x' ? [left, bottom] : [bottom, right];
  const along = (t: number, lift: number) => ({
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t - height * lift,
  });
  // Duże okno: rama na prawie całą długość, słupki dzielące szyby (po dwie na pole).
  // Wielokąt części okna przycięty do zakresu [range] długości (część na danym polu).
  const pane = (from: number, to: number, lift0: number, lift1: number) => {
    const t0 = Math.max(from, range[0]);
    const t1 = Math.min(to, range[1]);
    if (t1 <= t0) return [];
    return [along(t0, lift0), along(t1, lift0), along(t1, lift1), along(t0, lift1)];
  };
  const cells = axis === 'x' ? rect.width : rect.height;
  const margin = 0.06 / cells;
  fillPolygon(graphics, WINDOW_FRAME_COLOR, pane(margin, 1 - margin, 0.16, 0.9));
  const panes = Math.max(2, Math.round(cells * 2));
  const inner = 0.04 / cells;
  const width = (1 - 2 * margin) / panes;
  for (let i = 0; i < panes; i++) {
    const t0 = margin + i * width + inner;
    const t1 = margin + (i + 1) * width - inner;
    fillPolygon(graphics, WINDOW_COLOR, pane(t0, t1, 0.22, 0.84));
    // Odblask na szybie.
    fillPolygon(graphics, WINDOW_SHINE_COLOR, pane(t0 + inner, t0 + 3 * inner, 0.5, 0.8));
  }
}

type WindowSpan = { rect: Rect; axis: 'x' | 'y'; cells: GridPoint[] };

// Okno na tylnej ścianie (y = 0 wzdłuż X, x = 0 wzdłuż Y) rozciągnięte na następne pole,
// jeśli to nadal prosta ściana tylna; tafla o grubości ściany.
function windowSpan(window: GridPoint): WindowSpan | null {
  const axis = window.y === 0 ? 'x' : window.x === 0 ? 'y' : null;
  if (!axis) return null;
  const next = axis === 'x' ? { x: window.x + 1, y: 0 } : { x: 0, y: window.y + 1 };
  const own = wallBands(OFFICE_LAYOUT, window).find((b) => b.axis === axis);
  if (!own) return null;
  const following = wallBands(OFFICE_LAYOUT, next);
  const wide = following.length === 1 && following[0]?.axis === axis;
  const length = wide ? 2 : 1;
  const rect =
    axis === 'x'
      ? { ...own.rect, x: window.x, width: length }
      : { ...own.rect, y: window.y, height: length };
  return { rect, axis, cells: wide ? [window, next] : [window] };
}

let cachedSpans: WindowSpan[] | null = null;
function windowSpans(): WindowSpan[] {
  cachedSpans ??= OFFICE_LAYOUT.windows.flatMap((w) => windowSpan(w) ?? []);
  return cachedSpans;
}

// Zakres długości okna przypadający na pole `cell` (tylko tafla wzdłuż osi okna).
function spanPart(span: WindowSpan, cell: GridPoint, axis: 'x' | 'y'): [number, number] | null {
  if (axis !== span.axis) return null;
  const index = span.cells.findIndex((c) => c.x === cell.x && c.y === cell.y);
  if (index < 0) return null;
  const share = 1 / span.cells.length;
  // Wzdłuż Y okno rysowane jest od końca pola (róg „bottom” → „right”) — zakres odwrócony.
  return axis === 'x'
    ? [index * share, (index + 1) * share]
    : [1 - (index + 1) * share, 1 - index * share];
}
