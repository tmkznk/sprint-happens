import { removeEmployee } from '../staff';
import { reject, type CommandHandler, type FireEmployeeCommand } from './types';

// EMP-08, FIN-03 (Z): zwolnienie w trakcie dnia pracy, także na pauzie. Potwierdzenie
// z przydziałem i pełną należną dniówką pokazuje interfejs; dniówka zostaje w należnościach dnia.
export const fireEmployee: CommandHandler<FireEmployeeCommand> = {
  category: 'workDay',
  execute(state, command) {
    if (!state.staff.employees[command.employeeId]) return reject('unknownEmployee');
    return { ok: true, state: removeEmployee(state, command.employeeId, 'fired') };
  },
};
