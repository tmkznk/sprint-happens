import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { FurnitureId } from '../domain/furniture';
import { recordOperation } from '../simulation/finance';
import { testState } from '../test/engineFixture';
import { editCommand, editProblem, type FurnitureEdit } from './furnitureEdit';

const buyDesk: FurnitureEdit = {
  mode: 'buy',
  furnitureType: 'desk',
  origin: { x: 8, y: 7 },
  rotation: 0,
};

describe('tryb „Urządź” — ocena i polecenie (SH-013, SH-014)', () => {
  it('poprawny zakup nie ma problemu i daje polecenie BuyFurniture', () => {
    expect(editProblem(testState(), DEFAULT_BALANCE, buyDesk)).toBeNull();
    expect(editCommand(buyDesk)).toEqual({
      type: 'BuyFurniture',
      furnitureType: 'desk',
      origin: { x: 8, y: 7 },
      rotation: 0,
    });
  });

  it('zakup bez środków jest oceniany jak w silniku', () => {
    const start = testState();
    const poor = recordOperation(start, {
      key: 'event:x',
      kind: 'event',
      amount: 1000 - start.finance.cash,
    });
    if (!poor.ok) throw new Error('setup');

    expect(editProblem(poor.state, DEFAULT_BALANCE, buyDesk)).toBe('insufficientFunds');
  });

  it('przeniesienie na kolizję jest odrzucane; nieistniejący mebel zgłaszany', () => {
    const move: FurnitureEdit = {
      mode: 'move',
      furnitureId: 'furniture-2' as FurnitureId,
      origin: { x: 2, y: 7 },
      rotation: 0,
    };
    expect(editProblem(testState(), DEFAULT_BALANCE, move)).toBe('collision');
    expect(
      editProblem(testState(), DEFAULT_BALANCE, {
        ...move,
        furnitureId: 'furniture-9' as FurnitureId,
      }),
    ).toBe('unknownFurniture');
  });
});
