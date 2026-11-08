import type { Furniture } from '../../domain/furniture';
import { allocateId } from '../../domain/ids';
import { assignDeskToFirstDeskless, retargetEmployees, validateCandidate } from '../furniture';
import { storedCount, takeFromStorage } from './storage';
import { reject, type CommandHandler, type PlaceFromStorageCommand } from './types';

// SH-050: ustawienie mebla z magazynu w trybie „Urządź” (na pauzie) — bez opłaty, z tymi samymi
// regułami ustawienia co zakup (OFF-05). Nowe biurko trafia do pierwszej osoby bez biurka (OFF-04).
export const placeFromStorage: CommandHandler<PlaceFromStorageCommand> = {
  category: 'workDay',
  execute(state, command, config) {
    if (state.mission.speed !== 0) return reject('notPaused');
    if (storedCount(state, command.furnitureType) < 1) return reject('notInStorage');

    const allocated = allocateId(state.ids, 'furniture');
    const item: Furniture = {
      id: allocated.id,
      type: command.furnitureType,
      origin: command.origin,
      rotation: command.rotation,
    };
    const placement = validateCandidate(state, item);
    if (placement) return reject(placement);

    const taken = takeFromStorage(state, command.furnitureType);
    const placed = assignDeskToFirstDeskless(
      {
        ...taken,
        ids: allocated.sequence,
        world: { ...taken.world, furniture: { ...taken.world.furniture, [item.id]: item } },
      },
      item,
    );
    return { ok: true, state: retargetEmployees(placed, config) };
  },
};
