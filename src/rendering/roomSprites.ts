import { OFFICE_LAYOUT, PROLOGUE_LAYOUT, type OfficeLayout } from '../world/officeLayout';
import type { Bounds } from './cameraMath';
import meta from './roomSprites.json';

// Pomieszczenia wyrenderowane w całości z modeli 3D (tools/furniture-render, rooms.mjs): warstwa
// tylna (podłoga, ściany, drzwi, dekoracje) pod całą sceną i przednia (niskie ściany od strony
// kamery) nad nią. Kotwica to piksel punktu (0,0) siatki, obrazek w podwójnej rozdzielczości.
// Ściany działowe (biuro z kilkoma pokojami) to osobne kawałki — po jednym na pole ściany —
// z atlasu `<id>-pieces`; każdy dostaje w scenie głębokość swojego pola.
export type RoomPieceMeta = {
  x: number;
  y: number;
  frameX: number;
  frameY: number;
  width: number;
  height: number;
  // Piksel punktu (0,0) siatki względem lewego górnego rogu ramki.
  anchorX: number;
  anchorY: number;
};

// Fazy otwarcia drzwi wejściowych (tools/furniture-render, `<id>-door.png`): pasek klatek
// o jednakowym rozmiarze, kolejno coraz szerzej otwarte; zamknięte drzwi to samo tło.
export type RoomDoorMeta = {
  // Pole drzwi w siatce gry.
  x: number;
  y: number;
  angles: number[];
  // Przezroczysty odstęp między klatkami w pasku (px).
  gap: number;
  width: number;
  height: number;
  // Piksel punktu (0,0) siatki względem lewego górnego rogu klatki.
  anchorX: number;
  anchorY: number;
};

export type RoomSpriteMeta = {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  scale: number;
  pieces?: RoomPieceMeta[];
  door?: RoomDoorMeta;
  // Wymiary tego samego renderu bez terenu na zewnątrz (zapisuje je tools/furniture-render/build.mjs)
  // — obszar widoku startowego. Brak: nie ma terenu, cały obraz to pomieszczenie.
  fit?: { width: number; height: number; anchorX: number; anchorY: number };
};

const SPRITES = meta as Record<string, RoomSpriteMeta>;

// Układ biura → wyrenderowane pomieszczenie; biura bez renderu rysowane są z prostych brył.
const ROOM_OF_LAYOUT = new Map<OfficeLayout, string>([
  [PROLOGUE_LAYOUT, 'prologue'],
  [OFFICE_LAYOUT, 'office'],
]);

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

type RoomFrame = Pick<RoomSpriteMeta, 'width' | 'height' | 'anchorX' | 'anchorY'>;

function frameBounds(frame: RoomFrame, scale: number): Bounds {
  return {
    left: -frame.anchorX / scale,
    right: (frame.width - frame.anchorX) / scale,
    top: -frame.anchorY / scale,
    bottom: (frame.height - frame.anchorY) / scale,
  };
}

// Granice całego wyrenderowanego obrazu na ekranie świata (punkt (0,0) siatki to kotwica).
export function roomBounds(meta: RoomSpriteMeta): Bounds {
  return frameBounds(meta, meta.scale);
}

// Granice samego pomieszczenia, bez terenu na zewnątrz — do dopasowania widoku.
export function roomFitBounds(meta: RoomSpriteMeta): Bounds {
  return frameBounds(meta.fit ?? meta, meta.scale);
}

export const roomTextureKey = (id: string, layer: 'back' | 'front' | 'pieces' | 'door') =>
  `room-${id}-${layer}`;
