import type { BalanceConfig } from '../domain/config';
import type { Furniture, FurnitureId, FurnitureType, Rotation } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import type { GameState } from '../domain/state';
import type { Command, RejectionCode } from '../simulation/commands';
import { canPurchase } from '../simulation/finance';
import { validateCandidate } from '../simulation/furniture';

// UX-04 (Z): tryb „Urządź” — podgląd ustawienia mebla przed zatwierdzeniem: przeniesienie
// istniejącego albo zakup nowego. To stan prezentacji (T:ARCH-02): do silnika trafia dopiero
// polecenie MoveFurniture/BuyFurniture; anulowanie niczego nie zmienia.
export type FurnitureEdit =
  | { mode: 'move'; furnitureId: FurnitureId; origin: GridPoint; rotation: Rotation }
  | { mode: 'buy'; furnitureType: FurnitureType; origin: GridPoint; rotation: Rotation };

// Nowy mebel nie ma jeszcze ID w stanie — podgląd używa ID spoza sekwencji.
const PREVIEW_ID = 'furniture-0' as FurnitureId;

export function editCandidate(state: GameState, edit: FurnitureEdit): Furniture | null {
  if (edit.mode === 'buy') {
    return {
      id: PREVIEW_ID,
      type: edit.furnitureType,
      origin: edit.origin,
      rotation: edit.rotation,
    };
  }
  const item = state.world.furniture[edit.furnitureId];
  return item ? { ...item, origin: edit.origin, rotation: edit.rotation } : null;
}

// Ta sama ocena co w silniku — podgląd i pasek nie mają własnych reguł (OFF-05, FIN-08).
export function editProblem(
  state: GameState,
  config: BalanceConfig,
  edit: FurnitureEdit,
): RejectionCode | null {
  const candidate = editCandidate(state, edit);
  if (!candidate) return 'unknownFurniture';
  const placement = validateCandidate(state, candidate);
  if (placement) return placement;
  return edit.mode === 'buy'
    ? canPurchase(state, config.furniture.prices[edit.furnitureType])
    : null;
}

export function editCommand(edit: FurnitureEdit): Command {
  return edit.mode === 'buy'
    ? {
        type: 'BuyFurniture',
        furnitureType: edit.furnitureType,
        origin: edit.origin,
        rotation: edit.rotation,
      }
    : {
        type: 'MoveFurniture',
        furnitureId: edit.furnitureId,
        origin: edit.origin,
        rotation: edit.rotation,
      };
}

export type FurnitureEditStore = {
  get(): FurnitureEdit | null;
  set(edit: FurnitureEdit | null): void;
  subscribe(listener: () => void): () => void;
};

export function createFurnitureEditStore(): FurnitureEditStore {
  let edit: FurnitureEdit | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => edit,
    set(next) {
      edit = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
