import type { CommandHandler, StartNextDayCommand } from './types';

// TIME-04, TIME-08 (Z): „Następny dzień” po raporcie — tylko jeśli misja trwa (bramka silnika).
// Noc nie wymaga upływu czasu symulacji; nowy dzień zaczyna się na pauzie.
// Operacje dobowe: należna dniówka każdego zatrudnionego za nowy dzień (FIN-03). Pobranie
// dniówek przy rozliczeniu — SH-029. Kolejne dołączą z systemami: energia do 100% (SH-017,
// decyzja SH-004 A4c) i uzupełnienie ofert (SH-020).
export const startNextDay: CommandHandler<StartNextDayCommand> = {
  category: 'nextDay',
  execute(state) {
    return {
      ok: true,
      state: {
        ...state,
        finance: {
          ...state.finance,
          wagesDueToday: Object.fromEntries(
            Object.values(state.staff.employees).map((e) => [e.id, e.dailyWage]),
          ),
        },
        mission: {
          ...state.mission,
          day: state.mission.day + 1,
          phase: 'working',
          speed: 0,
          timeInDayMs: 0,
          report: null,
        },
      },
    };
  },
};
