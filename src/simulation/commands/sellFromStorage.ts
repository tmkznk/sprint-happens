import { allocateId } from '../../domain/ids';
import { recordOperation } from '../finance';
import { salePrice } from '../furniture';
import { storedCount, takeFromStorage } from './storage';
import { reject, type CommandHandler, type SellFromStorageCommand } from './types';

// SH-050, OFF-06: sprzedaż mebla z magazynu zwraca tę samą część ceny co sprzedaż z biura.
// Klucz operacji z własnej sekwencji — każda sprzedaż jest osobnym wpisem w księdze.
export const sellFromStorage: CommandHandler<SellFromStorageCommand> = {
  category: 'workDay',
  execute(state, command, config) {
    if (storedCount(state, command.furnitureType) < 1) return reject('notInStorage');
    const allocated = allocateId(state.ids, 'storageSale');
    const income = recordOperation(state, {
      key: `storage-sale:${allocated.id}`,
      kind: 'sale',
      amount: salePrice({ type: command.furnitureType }, config),
    });
    if (!income.ok) return reject(income.code);
    return {
      ok: true,
      state: { ...takeFromStorage(income.state, command.furnitureType), ids: allocated.sequence },
    };
  },
};
