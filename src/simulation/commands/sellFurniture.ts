import type { Employee } from '../../domain/employees';
import { recordOperation } from '../finance';
import {
  dropFurnitureDestinations,
  interruptFurnitureUse,
  retargetEmployees,
  salePrice,
} from '../furniture';
import { reject, type CommandHandler, type SellFurnitureCommand } from './types';

// OFF-06, OFF-07, FIN-06 (Z): sprzedaż zwraca część ceny (dozwolona także przy długu), wyłącznie
// na pauzie. Właściciel sprzedanego biurka traci stanowisko — przestaje pracować (PM traci premię),
// przydział do projektu zostaje. Korzystający z mebla tracą rezerwację.
// Potwierdzenie skutków sprzedaży używanego mebla zapewnia UI przed wysłaniem polecenia.
export const sellFurniture: CommandHandler<SellFurnitureCommand> = {
  category: 'workDay',
  execute(state, command, config) {
    if (state.mission.speed !== 0) return reject('notPaused');
    const item = state.world.furniture[command.furnitureId];
    if (!item) return reject('unknownFurniture');

    const income = recordOperation(state, {
      key: `sale:${item.id}`,
      kind: 'sale',
      amount: salePrice(item, config),
      ref: item.id,
    });
    if (!income.ok) return reject(income.code);

    const interrupted = dropFurnitureDestinations(
      interruptFurnitureUse(income.state, item.id),
      item.id,
    );
    const furniture = Object.fromEntries(
      Object.entries(interrupted.world.furniture).filter(([id]) => id !== item.id),
    ) as typeof interrupted.world.furniture;
    const employees = Object.fromEntries(
      Object.values(interrupted.staff.employees).map((e): [string, Employee] => [
        e.id,
        e.deskId === item.id ? { ...e, deskId: null } : e,
      ]),
    ) as typeof interrupted.staff.employees;

    const sold = {
      ...interrupted,
      staff: { ...interrupted.staff, employees },
      world: { ...interrupted.world, furniture },
    };
    return { ok: true, state: retargetEmployees(sold, config) };
  },
};
