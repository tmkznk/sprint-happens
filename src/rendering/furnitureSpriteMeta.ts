import { FURNITURE_TYPES, ROTATIONS, type FurnitureType, type Rotation } from '../domain/furniture';
import meta from './furnitureSprites.json';

// Pre-renderowane meble 3D (tools/furniture-render, paczka VNB Low Poly Office Set 2). Obrazki
// mają podwójną rozdzielczość (`scale`); kotwica to piksel narożnika (0,0) footprintu, czyli
// punkt gridToScreen(origin) w scenie. `heightPx` — najwyższy punkt bryły nad podłogą.
export type FurnitureSpriteMeta = {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  heightPx: number;
  scale: number;
};

const SPRITES = meta as Record<string, FurnitureSpriteMeta>;

export function furnitureSpriteKey(type: FurnitureType, rotation: Rotation): string {
  return `furniture-${type}-${rotation}`;
}

export function furnitureSpriteMeta(type: FurnitureType, rotation: Rotation): FurnitureSpriteMeta {
  const sprite = SPRITES[`${type}-${rotation}`];
  if (!sprite) throw new Error(`Brak sprite'a mebla ${type}-${rotation}`);
  return sprite;
}

// Wysokość bryły w pikselach gry — do zaznaczenia i trafiania dotykiem (picking.ts).
export function furnitureHeight(type: FurnitureType): number {
  return Math.max(
    ...ROTATIONS.map((rotation) => {
      const sprite = furnitureSpriteMeta(type, rotation);
      return Math.ceil(sprite.heightPx / sprite.scale);
    }),
  );
}

export const FURNITURE_HEIGHTS: Readonly<Record<FurnitureType, number>> = Object.fromEntries(
  FURNITURE_TYPES.map((type) => [type, furnitureHeight(type)]),
) as Record<FurnitureType, number>;
