import type { ScreenPoint } from './projection';

// Widok kamery Phaser z punktem odniesienia w środku (domyślny origin 0.5, bez obrotu — UX-03).
export type CameraView = {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
};

export type Bounds = { left: number; top: number; right: number; bottom: number };

export function screenToWorld(view: CameraView, point: ScreenPoint): ScreenPoint {
  return {
    x: (point.x - view.width / 2) / view.zoom + view.scrollX + view.width / 2,
    y: (point.y - view.height / 2) / view.zoom + view.scrollY + view.height / 2,
  };
}

export function pan(view: CameraView, dx: number, dy: number): CameraView {
  return {
    ...view,
    scrollX: view.scrollX - dx / view.zoom,
    scrollY: view.scrollY - dy / view.zoom,
  };
}

// Zmienia przybliżenie tak, aby punkt świata pod palcami (lub kursorem) pozostał w miejscu.
export function zoomAround(
  view: CameraView,
  factor: number,
  focus: ScreenPoint,
  minZoom: number,
  maxZoom: number,
): CameraView {
  const zoom = Math.min(Math.max(view.zoom * factor, minZoom), maxZoom);
  const world = screenToWorld(view, focus);
  return {
    ...view,
    zoom,
    scrollX: world.x - view.width / 2 - (focus.x - view.width / 2) / zoom,
    scrollY: world.y - view.height / 2 - (focus.y - view.height / 2) / zoom,
  };
}

// Utrzymuje środek widoku nad biurem, aby nie dało się go „zgubić” poza ekranem.
export function clampCenter(view: CameraView, bounds: Bounds): CameraView {
  const centerX = Math.min(Math.max(view.scrollX + view.width / 2, bounds.left), bounds.right);
  const centerY = Math.min(Math.max(view.scrollY + view.height / 2, bounds.top), bounds.bottom);
  return { ...view, scrollX: centerX - view.width / 2, scrollY: centerY - view.height / 2 };
}

export function fitZoom(view: CameraView, bounds: Bounds, margin = 0.95): number {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  return Math.min(view.width / width, view.height / height) * margin;
}

export function centerOn(view: CameraView, point: ScreenPoint): CameraView {
  return { ...view, scrollX: point.x - view.width / 2, scrollY: point.y - view.height / 2 };
}
