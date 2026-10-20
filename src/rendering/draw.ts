import * as Phaser from 'phaser';
import type { Rect } from '../world/officeLayout';
import { gridToScreen, type ScreenPoint } from './projection';

// Wspólne prymitywy rysowania zastępczych grafik izometrycznych.

// Narożniki prostokąta siatki na ekranie: górny, prawy, dolny, lewy.
export function rectCorners(rect: Rect): ScreenPoint[] {
  return [
    gridToScreen({ x: rect.x, y: rect.y }),
    gridToScreen({ x: rect.x + rect.width, y: rect.y }),
    gridToScreen({ x: rect.x + rect.width, y: rect.y + rect.height }),
    gridToScreen({ x: rect.x, y: rect.y + rect.height }),
  ];
}

export function drawPrism(
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

export function fillPolygon(
  graphics: Phaser.GameObjects.Graphics,
  color: number,
  points: ScreenPoint[],
): void {
  graphics.fillStyle(color, 1);
  graphics.fillPoints(toVectors(points), true);
}

export function toVectors(points: ScreenPoint[]): Phaser.Math.Vector2[] {
  return points.map((point) => new Phaser.Math.Vector2(point.x, point.y));
}

export function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
