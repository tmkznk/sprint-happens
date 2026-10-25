import type { FurnitureType } from '../domain/furniture';
import type { RoomId } from '../world/officeLayout';
import { FURNITURE_HEIGHTS } from './furnitureSpriteMeta';

// Zastępcze kolory i wysokości (px źródłowe) do czasu właściwych assetów (SH-035, SH-036).
// Wysokości służą też do trafiania dotykiem w bryłę obiektu (picking.ts).
export const FLOOR_COLORS: Record<RoomId, number> = {
  main: 0x8a7a5c,
  small: 0x7c8a5c,
  social: 0x5c7a8a,
};
export const DOOR_COLOR = 0x6b5a3e;
export const WALL_COLOR = 0xc9c3b6;
export const WINDOW_COLOR = 0x9fd3ff;
export const WINDOW_FRAME_COLOR = 0xe9e4d8;
export const WINDOW_SHINE_COLOR = 0xd4ecff;
// Meble mają już grafiki (pre-render 3D) — kolor zostaje dla podglądu ustawiania, wysokość
// pochodzi z wyrenderowanej bryły.
export const FURNITURE_STYLE: Record<FurnitureType, { color: number; height: number }> = {
  desk: { color: 0xb07a45, height: FURNITURE_HEIGHTS.desk },
  sofa: { color: 0x6a4fa3, height: FURNITURE_HEIGHTS.sofa },
  coffeeMachine: { color: 0x3d3d3d, height: FURNITURE_HEIGHTS.coffeeMachine },
  plant: { color: 0x4f8a3c, height: FURNITURE_HEIGHTS.plant },
};
export const BACK_WALL_HEIGHT = 48;
export const FRONT_WALL_HEIGHT = 12;
// T:ART-02 (R): stojąca postać ma około 48 px wysokości.
export const ACTOR_HEIGHT = 48;
export const ACTOR_COLOR = 0xf2c14e;
export const MARKER_COLOR = 0x55ff99;
export const SELECTION_COLOR = 0xf2c14e;
export const EDIT_VALID_COLOR = 0x3ddc84;
export const EDIT_INVALID_COLOR = 0xff3b3b;
