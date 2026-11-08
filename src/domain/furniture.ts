import type { GridPoint, Size } from './grid';
import type { EntityId } from './ids';

export const FURNITURE_TYPES = [
  'desk',
  'sofa',
  'coffeeMachine',
  'plant',
  'conferenceTable',
] as const;
export type FurnitureType = (typeof FURNITURE_TYPES)[number];

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
  // SH-052: miejsca stojące (stół konferencyjny) — cele ruchu, ale ich zastawienie nie blokuje
  // ustawienia mebla (nie są wymaganymi punktami korzystania).
  standingPoints?: readonly GridPoint[];
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
  // Roślina — dekoracja (decyzja właściciela 2026-10-25): pole jak ekspres, nikt z niej nie korzysta.
  // W MVP nie wpływa na rozgrywkę; docelowo ma poprawiać zadowolenie pracowników (poza MVP).
  plant: { footprint: { width: 1, height: 1 }, interactionPoints: [] },
  // SH-052 (rozdział 2): stół konferencyjny 4×2 — 8 miejsc siedzących na dłuższych bokach (na nich
  // stoją krzesła) i 8 stojących przy krótszych bokach i w narożnikach. Spotkania Scruma.
  conferenceTable: {
    footprint: { width: 4, height: 2 },
    interactionPoints: [
      ...[0, 1, 2, 3].map((x) => ({ x, y: -1 })),
      ...[0, 1, 2, 3].map((x) => ({ x, y: 2 })),
    ],
    standingPoints: [
      { x: -1, y: 0 },
      { x: -1, y: 1 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: -1, y: -1 },
      { x: 4, y: -1 },
      { x: -1, y: 2 },
      { x: 4, y: 2 },
    ],
  },
};

// SH-052: meble dostępne tylko w rozdziale 2.
export const CHAPTER_TWO_FURNITURE: readonly FurnitureType[] = ['conferenceTable'];
