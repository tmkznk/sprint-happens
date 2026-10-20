import * as Phaser from 'phaser';
import {
  centerOn,
  clampCenter,
  fitZoom,
  pan,
  screenToWorld,
  zoomAround,
  type Bounds,
  type CameraView,
} from './cameraMath';
import { createGestureTracker, type GestureAction, type PointerSample } from './gestures';
import type { ScreenPoint } from './projection';

// T:ART-06 (O): zakres przybliżenia do oceny na urządzeniu.
const MIN_ZOOM_OF_FIT = 0.8;
const MAX_ZOOM = 3;
const WHEEL_ZOOM_SPEED = 0.0015;

export type OfficeCameraOptions = {
  bounds: Bounds;
  onTap(world: ScreenPoint): void;
};

// UX-02, UX-03 (Z): przeciąganie przesuwa kamerę, dwa palce lub kółko zmieniają przybliżenie;
// kąt kamery jest stały. Działa niezależnie od tempa gry, także na pauzie.
export function attachOfficeCamera(scene: Phaser.Scene, options: OfficeCameraOptions): () => void {
  const camera = scene.cameras.main;
  const tracker = createGestureTracker();
  let minZoom = 0;

  const readView = (): CameraView => ({
    scrollX: camera.scrollX,
    scrollY: camera.scrollY,
    zoom: camera.zoom,
    width: scene.scale.width,
    height: scene.scale.height,
  });

  const applyView = (view: CameraView) => {
    const clamped = clampCenter(view, options.bounds);
    camera.setZoom(clamped.zoom);
    camera.setScroll(clamped.scrollX, clamped.scrollY);
  };

  const fit = () => {
    const view = readView();
    const zoom = fitZoom(view, options.bounds);
    minZoom = zoom * MIN_ZOOM_OF_FIT;
    applyView(
      centerOn(
        { ...view, zoom },
        {
          x: (options.bounds.left + options.bounds.right) / 2,
          y: (options.bounds.top + options.bounds.bottom) / 2,
        },
      ),
    );
  };

  const onResize = () => {
    const view = readView();
    minZoom = fitZoom(view, options.bounds) * MIN_ZOOM_OF_FIT;
    applyView({ ...view, zoom: Math.min(Math.max(view.zoom, minZoom), MAX_ZOOM) });
  };

  const handle = (actions: GestureAction[]) => {
    for (const action of actions) {
      const view = readView();
      if (action.type === 'pan') applyView(pan(view, action.dx, action.dy));
      if (action.type === 'pinch') {
        const focus = { x: action.centerX, y: action.centerY };
        applyView(zoomAround(view, action.factor, focus, minZoom, MAX_ZOOM));
      }
      if (action.type === 'tap') options.onTap(screenToWorld(view, action));
    }
  };

  const sample = (pointer: Phaser.Input.Pointer): PointerSample => ({
    id: pointer.id,
    x: pointer.x,
    y: pointer.y,
  });

  // T:VIEW-03 — gest rozpoczęty poza canvasem (np. na panelu React) nie steruje biurem.
  const onDown = (pointer: Phaser.Input.Pointer) => {
    if (pointer.downElement !== scene.game.canvas) return;
    handle(tracker.down(sample(pointer)));
  };
  const onMove = (pointer: Phaser.Input.Pointer) => handle(tracker.move(sample(pointer)));
  const onUp = (pointer: Phaser.Input.Pointer) => handle(tracker.up(sample(pointer)));
  const onWheel = (
    pointer: Phaser.Input.Pointer,
    _over: unknown,
    _deltaX: number,
    deltaY: number,
  ) => {
    const focus = { x: pointer.x, y: pointer.y };
    applyView(
      zoomAround(readView(), Math.exp(-deltaY * WHEEL_ZOOM_SPEED), focus, minZoom, MAX_ZOOM),
    );
  };

  const { Events } = Phaser.Input;
  scene.input.on(Events.POINTER_DOWN, onDown);
  scene.input.on(Events.POINTER_MOVE, onMove);
  scene.input.on(Events.POINTER_UP, onUp);
  scene.input.on(Events.POINTER_UP_OUTSIDE, onUp);
  scene.input.on(Events.POINTER_WHEEL, onWheel);
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  fit();

  return () => {
    scene.input.off(Events.POINTER_DOWN, onDown);
    scene.input.off(Events.POINTER_MOVE, onMove);
    scene.input.off(Events.POINTER_UP, onUp);
    scene.input.off(Events.POINTER_UP_OUTSIDE, onUp);
    scene.input.off(Events.POINTER_WHEEL, onWheel);
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    tracker.cancel();
  };
}
