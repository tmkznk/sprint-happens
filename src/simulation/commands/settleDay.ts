import type { CommandHandler, SettleDayCommand } from './types';

// TIME-08 (Z): „Rozlicz dzień” — dokładnie raz, po zakończeniu pracy. Kolejność rozliczenia:
// koszty → kontrola bankructwa → kontrola zwycięstwa (SH-029, SH-030). Druga próba rozliczenia
// tego samego dnia jest odrzucana przez fazę `settled`, także po zapisie i wczytaniu.
export const settleDay: CommandHandler<SettleDayCommand> = {
  category: 'settlement',
  execute(state) {
    return {
      ok: true,
      state: {
        ...state,
        mission: {
          ...state.mission,
          phase: 'settled',
          report: { day: state.mission.day, cashAfterSettlement: state.finance.cash },
        },
      },
    };
  },
};
