import { retargetEmployees } from '../furniture';
import { reject, type AssignDeskCommand, type CommandHandler } from './types';

// OFF-04 (Z): ręczna zmiana biurka. Zajęte biurko jest odrzucane — nigdy dwa przypisania
// do jednego stanowiska. `deskId: null` odbiera biurko (osoba nie pracuje, pensja zostaje).
export const assignDesk: CommandHandler<AssignDeskCommand> = {
  category: 'workDay',
  execute(state, command, config) {
    const employee = state.staff.employees[command.employeeId];
    if (!employee) return reject('unknownEmployee');
    if (employee.deskId === command.deskId) return { ok: true, state };
    if (command.deskId !== null) {
      if (state.world.furniture[command.deskId]?.type !== 'desk') return reject('notADesk');
      const holder = Object.values(state.staff.employees).find((e) => e.deskId === command.deskId);
      if (holder) return reject('deskTaken');
    }
    const assigned = {
      ...state,
      staff: {
        ...state.staff,
        employees: {
          ...state.staff.employees,
          [employee.id]: { ...employee, deskId: command.deskId },
        },
      },
    };
    return { ok: true, state: retargetEmployees(assigned, config) };
  },
};
