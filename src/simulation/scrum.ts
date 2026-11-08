import type { Employee } from '../domain/employees';
import type { GameState } from '../domain/state';

// Rozdział 2 — Scrum (SH-053–SH-056).

export function isScrumMaster(employee: Pick<Employee, 'specialization'>): boolean {
  return employee.specialization === 'scrumMaster';
}

// SH-053: jeden Scrum Master na firmę.
export function scrumMasterOf(state: GameState): Employee | null {
  return Object.values(state.staff.employees).find(isScrumMaster) ?? null;
}
