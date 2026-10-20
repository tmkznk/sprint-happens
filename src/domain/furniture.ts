import type { GridPoint, Size } from './grid';
import type { EntityId } from './ids';

export type FurnitureType = 'desk' | 'sofa' | 'coffeeMachine';

// OFF-03 (Z): obrót co 90°; kamera ma stały kąt (UX-03).
export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

export type FurnitureId = EntityId<'furniture'>;

export type Furniture = {
  id: FurnitureId;
  type: FurnitureType;
  // Lewe górne pole footprintu po obrocie.
  origin: GridPoint;
  rotation: Rotation;
};

export type FurnitureSpec = {
  // Footprint przy obrocie 0°.
  footprint: Size;
  // MOVE-02 (Z): punkty korzystania względem origin przy obrocie 0°, poza footprintem.
  interactionPoints: readonly GridPoint[];
};

// T:ART-02 (R): robocze gabaryty i punkty interakcji, do weryfikacji makietą w SH-002.
export const FURNITURE_CATALOG: Readonly<Record<FurnitureType, FurnitureSpec>> = {
  // Biurko z komputerem i krzesłem jako jeden obiekt (OFF-03); pracownik siada od frontu.
  desk: { footprint: { width: 3, height: 2 }, interactionPoints: [{ x: 1, y: 2 }] },
  // NEED-02 (Z): kanapa mieści dwie osoby — dwa osobne punkty interakcji.
  sofa: {
    footprint: { width: 3, height: 2 },
    interactionPoints: [
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ],
  },
  // NEED-02 (Z): ekspres obsługuje jedną osobę.
  coffeeMachine: { footprint: { width: 1, height: 1 }, interactionPoints: [{ x: 0, y: 1 }] },
};
