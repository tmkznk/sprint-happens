import type { Employee } from '../../domain/employees';
import type { Furniture } from '../../domain/furniture';
import { allocateId } from '../../domain/ids';
import { canPurchase, recordOperation } from '../finance';
import { retargetEmployees, validateCandidate } from '../furniture';
import { compareIds } from '../staff';
import { reject, type BuyFurnitureCommand, type CommandHandler } from './types';

// OFF-03, OFF-05, FIN-08 (Z): zakup i ustawienie wyposażenia w trybie „Urządź” (na pauzie).
// Cena jest pobierana raz i tylko przy poprawnym ustawieniu; zakup wymaga pełnej kwoty
// i jest zablokowany przy długu (FIN-06). Nowe biurko trafia do pierwszej osoby bez biurka (OFF-04).
export const buyFurniture: CommandHandler<BuyFurnitureCommand> = {
  category: 'workDay',
  execute(state, command, config) {
    if (state.mission.speed !== 0) return reject('notPaused');
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

    const deskless =
      item.type === 'desk'
        ? Object.values(paid.state.staff.employees)
            .filter((employee) => employee.deskId === null)
            .sort((a, b) => compareIds(a.id, b.id))[0]
        : undefined;
    const employees = deskless
      ? {
          ...paid.state.staff.employees,
          [deskless.id]: { ...deskless, deskId: item.id } as Employee,
        }
      : paid.state.staff.employees;

    const bought = {
      ...paid.state,
      ids: allocated.sequence,
      staff: { ...paid.state.staff, employees },
      world: { ...paid.state.world, furniture: { ...paid.state.world.furniture, [item.id]: item } },
    };
    return { ok: true, state: retargetEmployees(bought, config) };
  },
};
