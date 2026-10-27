import { PROLOGUE_LAYOUT, type OfficeLayout } from '../world/officeLayout';
import meta from './roomSprites.json';

// Pomieszczenia wyrenderowane w całości z modeli 3D (tools/furniture-render, rooms.mjs): warstwa
// tylna (podłoga, ściany, drzwi, dekoracje) pod całą sceną i przednia (niskie ściany od strony
// kamery) nad nią. Kotwica to piksel punktu (0,0) siatki, obrazek w podwójnej rozdzielczości.
export type RoomSpriteMeta = {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  scale: number;
};

const SPRITES = meta as Record<string, RoomSpriteMeta>;

// Układ biura → wyrenderowane pomieszczenie; biura bez renderu rysowane są z prostych brył.
const ROOM_OF_LAYOUT = new Map<OfficeLayout, string>([[PROLOGUE_LAYOUT, 'prologue']]);

export const ROOM_TEXTURES = Object.entries(
  import.meta.glob<string>('../assets/rooms/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
).map(([path, url]) => [`room-${path.replace(/^.*\/(.+)\.png$/, '$1')}`, url] as const);

export function roomSprite(layout: OfficeLayout): { id: string; meta: RoomSpriteMeta } | null {
  const id = ROOM_OF_LAYOUT.get(layout);
  const sprite = id ? SPRITES[id] : undefined;
  return id && sprite ? { id, meta: sprite } : null;
}

export const roomTextureKey = (id: string, layer: 'back' | 'front') => `room-${id}-${layer}`;
