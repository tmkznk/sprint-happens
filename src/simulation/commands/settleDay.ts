import { settle } from '../settlement';
import type { CommandHandler, SettleDayCommand } from './types';

// TIME-08 (Z): „Rozlicz dzień” — dokładnie raz, po zakończeniu pracy. Kolejność rozliczenia:
// koszty → kontrola bankructwa → kontrola zwycięstwa (SH-029, SH-030). Druga próba rozliczenia
// tego samego dnia jest odrzucana przez fazę `settled`, także po zapisie i wczytaniu.
export const settleDay: CommandHandler<SettleDayCommand> = {
  category: 'settlement',
  execute(state, _command, config) {
    return { ok: true, state: settle(state, config) };
  },
};
