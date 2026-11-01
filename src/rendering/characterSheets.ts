import type { Facing, PoseKind } from './agentPose';
import characterMeta from './characterSprites.json';
import smokingMeta from './smokingSprites.json';

// Metadane atlasów postaci (bez Phasera, żeby dało się je testować w node). Palenie ma osobny mały
// atlas z własną, większą ramką (tools/furniture-render): wyższą na dym i szerszą na cały cień.
type AnimMeta = { start: number; frames: number; fps: number };

export type SheetMeta<Kind extends PoseKind = PoseKind> = {
  frameWidth: number;
  frameHeight: number;
  anchorX: number;
  anchorY: number;
  scale: number;
  columns: number;
  rows: Facing[];
  anims: Record<Kind, AnimMeta>;
};

export const CHARACTER_SHEET = characterMeta as SheetMeta<Exclude<PoseKind, 'smoke'>>;
export const SMOKE_SHEET = smokingMeta as SheetMeta<'smoke'>;

export function sheetOf(kind: PoseKind): Omit<SheetMeta, 'anims'> {
  return kind === 'smoke' ? SMOKE_SHEET : CHARACTER_SHEET;
}

// Origin sprite'a, przy którym kotwica klatki (stopy) trafia w pozycję postaci. Phaser przy zmianie
// klatki zachowuje origin ułamkowy, więc po przejściu na inną ramkę trzeba go przełączyć razem
// z animacją.
export function sheetOrigin(kind: PoseKind): { x: number; y: number } {
  const sheet = sheetOf(kind);
  return { x: sheet.anchorX / sheet.frameWidth, y: sheet.anchorY / sheet.frameHeight };
}

// Do czasu załadowania atlasu palenia postać po prostu stoi.
export function shownPoseKind(kind: PoseKind, smokeReady: boolean): PoseKind {
  return kind === 'smoke' && !smokeReady ? 'idle' : kind;
}
