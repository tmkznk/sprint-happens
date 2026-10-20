import type { Furniture, FurnitureId } from '../domain/furniture';
import type { Rect } from '../world/officeLayout';
import { footprintSize } from '../world/geometry';
import type { ReadonlyAgent } from '../domain/movement';
import { displayPosition } from './agentPosition';
import { ACTOR_HEIGHT, FURNITURE_STYLE } from './placeholderStyle';
import { depthOfFootprint, depthOfPoint, gridToScreen, type ScreenPoint } from './projection';

// Obrys bryły na ekranie (górny-lewy, górny-górny, górny-prawy, prawy, dolny, lewy) —
// dotknięcie górnej części wysokiego obiektu trafia w obiekt, a nie w podłogę za nim.
export function prismSilhouette(rect: Rect, height: number): ScreenPoint[] {
  const top = gridToScreen({ x: rect.x, y: rect.y });
  const right = gridToScreen({ x: rect.x + rect.width, y: rect.y });
  const bottom = gridToScreen({ x: rect.x + rect.width, y: rect.y + rect.height });
  const left = gridToScreen({ x: rect.x, y: rect.y + rect.height });
  const up = (point: ScreenPoint) => ({ x: point.x, y: point.y - height });
  return [up(left), up(top), up(right), right, bottom, left];
}

export function furnitureRect(furniture: Furniture): Rect {
  return { ...furniture.origin, ...footprintSize(furniture) };
}

// UX-01 (Z): wybór obiektu dotknięciem. Przy nakładaniu się brył wygrywa bliższa kamerze.
export function pickFurniture(
  world: ScreenPoint,
  furniture: readonly Furniture[],
): FurnitureId | null {
  const candidates = furniture
    .map((item) => ({ item, rect: furnitureRect(item) }))
    .sort((a, b) => depthOfFootprint(b.rect, b.rect) - depthOfFootprint(a.rect, a.rect));
  for (const { item, rect } of candidates) {
    if (pointInPolygon(world, prismSilhouette(rect, FURNITURE_STYLE[item.type].height))) {
      return item.id;
    }
  }
  return null;
}

export function pointInPolygon(point: ScreenPoint, polygon: readonly ScreenPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    if (a.y > point.y !== b.y > point.y) {
      const crossX = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < crossX) inside = !inside;
    }
  }
  return inside;
}

// UX-01 (Z): wybór postaci dotknięciem — prostokąt sylwetki w pozycji wyświetlanej (z interpolacją).
// Postacie mają pierwszeństwo przed meblami; przy nakładaniu wygrywa bliższa kamerze.
const AGENT_HALF_WIDTH = 12;

export function pickAgent(
  world: ScreenPoint,
  agents: readonly ReadonlyAgent[],
  alpha: number,
  stepsPerCell: number,
): string | null {
  let best: { id: string; depth: number } | null = null;
  for (const agent of agents) {
    const position = displayPosition(agent, alpha, stepsPerCell);
    const screen = gridToScreen(position);
    const inside =
      Math.abs(world.x - screen.x) <= AGENT_HALF_WIDTH &&
      world.y >= screen.y - ACTOR_HEIGHT - 2 &&
      world.y <= screen.y + 6;
    const depth = depthOfPoint(position);
    if (inside && (!best || depth > best.depth)) best = { id: agent.id, depth };
  }
  return best?.id ?? null;
}
