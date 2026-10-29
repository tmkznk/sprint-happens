import { describe, expect, it } from 'vitest';
import type { Selection } from '../application/selection';
import { DEFAULT_BALANCE } from '../domain/config';
import type { EmployeeId } from '../domain/employees';
import type { FurnitureId } from '../domain/furniture';
import type { GameState } from '../domain/state';
import { createEngine } from '../simulation/engine';
import { testState } from '../test/engineFixture';
import { tapIntent } from './tapIntent';

const DESK = 'furniture-1' as FurnitureId;
const CELL = { x: 3, y: 4 };

// Stan z dwoma zatrudnionymi pracownikami.
function withStaff(): { state: GameState; first: EmployeeId; second: EmployeeId } {
  const engine = createEngine({ config: DEFAULT_BALANCE, initialState: testState() });
  for (let i = 0; i < 2; i++) {
    const candidate = engine.getState().staff.candidates[0];
    if (!candidate) throw new Error('brak kandydata');
    engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
  }
  const state = engine.getState();
  const [first, second] = Object.keys(state.staff.employees) as EmployeeId[];
  if (!first || !second) throw new Error('brak pracowników');
  return { state, first, second };
}

describe('tapIntent', () => {
  const { state, first, second } = withStaff();
  const selectedFirst: Selection = { kind: 'employee', id: first };
  const tap = (selection: Selection, hit: { agentId?: string; furnitureId?: FurnitureId }) =>
    tapIntent({
      state,
      selection,
      editing: false,
      agentId: hit.agentId ?? null,
      furnitureId: hit.furnitureId ?? null,
      cell: CELL,
    });

  it('w trybie „Urządź” nic nie robi (scena przestawia mebel)', () => {
    expect(
      tapIntent({
        state,
        selection: selectedFirst,
        editing: true,
        agentId: second,
        furnitureId: DESK,
        cell: CELL,
      }),
    ).toEqual({ kind: 'none' });
  });

  it('trafiona postać zostaje zaznaczona — także gdy zaznaczona jest inna albo ta sama', () => {
    expect(tap(null, { agentId: first })).toEqual({ kind: 'select', selection: selectedFirst });
    expect(tap(selectedFirst, { agentId: second, furnitureId: DESK })).toEqual({
      kind: 'select',
      selection: { kind: 'employee', id: second },
    });
    expect(tap(selectedFirst, { agentId: first })).toEqual({
      kind: 'select',
      selection: selectedFirst,
    });
  });

  it('zaznaczona postać + mebel → rozkaz z meblem', () => {
    expect(tap(selectedFirst, { furnitureId: DESK })).toEqual({
      kind: 'order',
      command: {
        type: 'OrderEmployee',
        employeeId: first,
        target: { kind: 'furniture', furnitureId: DESK },
      },
    });
  });

  it('zaznaczona postać + podłoga → rozkaz z polem', () => {
    expect(tap(selectedFirst, {})).toEqual({
      kind: 'order',
      command: { type: 'OrderEmployee', employeeId: first, target: { kind: 'cell', cell: CELL } },
    });
  });

  it('bez zaznaczonej postaci mebel zostaje zaznaczony', () => {
    const furniture: Selection = { kind: 'furniture', id: DESK };
    expect(tap(null, { furnitureId: DESK })).toEqual({ kind: 'select', selection: furniture });
    expect(tap(furniture, { furnitureId: DESK })).toEqual({ kind: 'select', selection: furniture });
  });

  it('bez zaznaczonej postaci puste miejsce czyści zaznaczenie', () => {
    expect(tap(null, {})).toEqual({ kind: 'select', selection: null });
    expect(tap({ kind: 'furniture', id: DESK }, {})).toEqual({ kind: 'select', selection: null });
  });

  it('nieistniejąca postać (zwolniona) nie jest celem ani źródłem rozkazu', () => {
    const gone: Selection = { kind: 'employee', id: 'employee-999' as EmployeeId };
    expect(tap(null, { agentId: 'employee-999' })).toEqual({ kind: 'select', selection: null });
    expect(tap(gone, {})).toEqual({ kind: 'select', selection: null });
  });
});
