import type { Selection } from '../application/selection';
import type { EmployeeId } from '../domain/employees';
import type { FurnitureId } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import type { GameState } from '../domain/state';
import type { OrderEmployeeCommand } from '../simulation/commands/types';

// Co oznacza dotknięcie sceny (F:UX-01). Czysta funkcja — scena tylko wykonuje zamiar.
export type TapIntent =
  | { kind: 'none' }
  | { kind: 'select'; selection: Selection }
  | { kind: 'order'; command: OrderEmployeeCommand };

export type TapInput = {
  state: GameState;
  selection: Selection;
  // Tryb „Urządź” — dotknięcia przestawiają mebel, sterowanie postaciami jest wyłączone.
  editing: boolean;
  // Trafiona postać (id agenta ruchu) i mebel pod palcem; `cell` — pole podłogi pod palcem.
  agentId: string | null;
  furnitureId: FurnitureId | null;
  cell: GridPoint;
};

// Rozkaz nie jest tu walidowany — rozstrzyga silnik (T:ARCH-03), a odmowę pokazuje pasek.
export function tapIntent(input: TapInput): TapIntent {
  const { state, selection, agentId, furnitureId, cell } = input;
  if (input.editing) return { kind: 'none' };
  const { employees } = state.staff;
  const hit = agentId ? employees[agentId as EmployeeId] : undefined;
  // Dotknięcie postaci zaznacza ją (także ponowne dotknięcie zaznaczonej — bez przełączania).
  if (hit) return { kind: 'select', selection: { kind: 'employee', id: hit.id } };
  const ordered =
    selection?.kind === 'employee' && employees[selection.id] ? selection.id : undefined;
  if (ordered) {
    return {
      kind: 'order',
      command: {
        type: 'OrderEmployee',
        employeeId: ordered,
        target: furnitureId ? { kind: 'furniture', furnitureId } : { kind: 'cell', cell },
      },
    };
  }
  return { kind: 'select', selection: furnitureId ? { kind: 'furniture', id: furnitureId } : null };
}
