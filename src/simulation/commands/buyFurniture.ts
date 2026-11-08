import { CHAPTER_TWO_FURNITURE, type Furniture } from '../../domain/furniture';
import { allocateId } from '../../domain/ids';
import { canPurchase, recordOperation } from '../finance';
import { assignDeskToFirstDeskless, retargetEmployees, validateCandidate } from '../furniture';
import { reject, type BuyFurnitureCommand, type CommandHandler } from './types';

// OFF-03, OFF-05, FIN-08 (Z): zakup i ustawienie wyposażenia w trybie „Urządź” (na pauzie).
// Cena jest pobierana raz i tylko przy poprawnym ustawieniu; zakup wymaga pełnej kwoty
// i jest zablokowany przy długu (FIN-06). Nowe biurko trafia do pierwszej osoby bez biurka (OFF-04).
export const buyFurniture: CommandHandler<BuyFurnitureCommand> = {
  category: 'workDay',
  execute(state, command, config) {
    if (state.mission.speed !== 0) return reject('notPaused');
    // SH-052: stół konferencyjny tylko w rozdziale 2.
    if (CHAPTER_TWO_FURNITURE.includes(command.furnitureType) && state.mission.chapter !== 2) {
      return reject('notAvailable');
    }
    const price = config.furniture.prices[command.furnitureType];
    const funds = canPurchase(state, price);
    if (funds) return reject(funds);

    const allocated = allocateId(state.ids, 'furniture');
    const item: Furniture = {
      id: allocated.id,
      type: command.furnitureType,
      origin: command.origin,
      rotation: command.rotation,
    };
    const placement = validateCandidate(state, item);
    if (placement) return reject(placement);

    const paid = recordOperation(state, {
      key: `purchase:${item.id}`,
      kind: 'purchase',
      amount: -price,
      ref: item.id,
    });
    if (!paid.ok) return reject(paid.code);

    const bought = assignDeskToFirstDeskless(
      {
        ...paid.state,
        ids: allocated.sequence,
        world: {
          ...paid.state.world,
          furniture: { ...paid.state.world.furniture, [item.id]: item },
        },
      },
      item,
    );
    return { ok: true, state: retargetEmployees(bought, config) };
  },
};
