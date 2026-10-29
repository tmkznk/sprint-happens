import type { BalanceConfig } from '../../domain/config';
import type { EmployeeId } from '../../domain/employees';
import type { FurnitureId } from '../../domain/furniture';
import type { GameState } from '../../domain/state';
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
    return { ok: true, state: assignDeskTo(state, employee.id, command.deskId, config) };
  },
};

// Przypisanie zwalidowanego biurka (AssignDesk, rozkaz OrderEmployee): poprzednie się zwalnia,
// a osoba dostaje nowy cel. Pozostali pracownicy zachowują swoje cele (np. stanie z rozkazu).
export function assignDeskTo(
  state: GameState,
  employeeId: EmployeeId,
  deskId: FurnitureId | null,
  config: BalanceConfig,
): GameState {
  const employee = state.staff.employees[employeeId];
  if (!employee) return state;
  const assigned = {
    ...state,
    staff: {
      ...state.staff,
      employees: { ...state.staff.employees, [employeeId]: { ...employee, deskId } },
    },
  };
  return retargetEmployees(assigned, config, employeeId);
}
