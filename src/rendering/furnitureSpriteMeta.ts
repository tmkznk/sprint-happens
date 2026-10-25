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

// Część obrazka: typ mebla albo dodatkowa warstwa (`deskChair` — krzesło biurka).
export type FurnitureSpritePart = FurnitureType | 'deskChair';

export function furnitureSpriteKey(part: FurnitureSpritePart, rotation: Rotation): string {
  return `furniture-${part}-${rotation}`;
}

export function furnitureSpriteMeta(
  part: FurnitureSpritePart,
  rotation: Rotation,
): FurnitureSpriteMeta {
  const sprite = SPRITES[`${part}-${rotation}`];
  if (!sprite) throw new Error(`Brak sprite'a mebla ${part}-${rotation}`);
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
