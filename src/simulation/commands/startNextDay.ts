import { fillBoard } from '../../domain/contractBoard';
import { MAX_ENERGY } from '../../domain/employees';
import { returnToOffice } from '../commute';
import { scheduleDay } from '../events';
import type { CommandHandler, StartNextDayCommand } from './types';

// TIME-04, TIME-08 (Z): „Następny dzień” po raporcie — tylko jeśli misja trwa (bramka silnika).
// Noc nie wymaga upływu czasu symulacji; nowy dzień zaczyna się na pauzie.
// Operacje dobowe: należna dniówka każdego zatrudnionego za nowy dzień (FIN-03) i uzupełnienie
// wolnych miejsc na tablicy zleceń (CON-01) oraz pełna energia po nocy (SH-004 A4c).
export const startNextDay: CommandHandler<StartNextDayCommand> = {
  category: 'nextDay',
  execute(state, _command, config) {
    const board = fillBoard(
      { offers: [...state.contracts.offers], ids: state.ids, rng: state.rng },
      state.contracts.deliveredCount,
      config,
    );
    const next: typeof state = {
      ...state,
      contracts: { ...state.contracts, offers: board.offers },
      // TIME-05, decyzja SH-004 A4c: noc przywraca pełną energię; zadowolenie bez zmian.
      staff: {
        ...state.staff,
        employees: Object.fromEntries(
          Object.values(state.staff.employees).map((e) => [e.id, { ...e, energy: MAX_ENERGY }]),
        ) as typeof state.staff.employees,
      },
      ids: board.ids,
      rng: board.rng,
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
    };
    // EVT-03: o zdarzeniu dnia (i jego chwili) rozstrzyga się na początku dnia.
    return { ok: true, state: scheduleDay(returnToOffice(next, config), config) };
  },
};
