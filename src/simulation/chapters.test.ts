import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { MAX_ENERGY, SENIORITIES, SPECIALIZATIONS } from '../domain/employees';
import { wonChapterOne } from '../test/chapterFixture';
import { deepFreeze } from '../test/deepFreeze';
import { beginChapterTwo } from './chapters';

describe('beginChapterTwo (SH-049)', () => {
  const won = wonChapterOne();
  const result = beginChapterTwo(won, DEFAULT_BALANCE);
  if (!result.ok) throw new Error(result.code);
  const next = result.state;

  it('start rozdziału 2: misja trwa, następny dzień, faza przyjścia, pauza', () => {
    expect(next.mission).toMatchObject({
      chapter: 2,
      status: 'active',
      phase: 'arriving',
      speed: 0,
      day: won.mission.day + 1,
      report: null,
    });
  });

  it('meble trafiają do magazynu, biuro jest puste', () => {
    expect(next.world.storage).toEqual({ desk: 3, sofa: 1, coffeeMachine: 1 });
    expect(next.world.furniture).toEqual({});
  });

  it('pracownicy zostają bez biurek, z przydziałami i pełną energią', () => {
    const before = Object.values(won.staff.employees);
    const after = Object.values(next.staff.employees);
    expect(after.map((e) => e.id)).toEqual(before.map((e) => e.id));
    for (const employee of after) {
      expect(employee.deskId).toBeNull();
      expect(employee.energy).toBe(MAX_ENERGY);
      expect(employee.projectId).toBe(won.staff.employees[employee.id]?.projectId);
    }
  });

  it('aktywny projekt przechodzi z postępem i terminem', () => {
    expect(next.contracts.projects).toEqual(won.contracts.projects);
  });

  it('licznik rozdziału od zera, licznik kampanii bez zmian; gotówka i reputacja przechodzą', () => {
    expect(next.contracts.chapterDeliveredCount).toBe(0);
    expect(next.contracts.deliveredCount).toBe(won.contracts.deliveredCount);
    expect(next.finance.cash).toBe(won.finance.cash);
    expect(next.mission.reputation).toBe(won.mission.reputation);
  });

  it('nowa tablica zleceń i pełny rynek kandydatów', () => {
    expect(next.contracts.offers).toHaveLength(DEFAULT_BALANCE.contracts.boardSize);
    for (const specialization of SPECIALIZATIONS) {
      for (const seniority of SENIORITIES) {
        expect(
          next.staff.candidates.some(
            (c) => c.specialization === specialization && c.seniority === seniority,
          ),
        ).toBe(true);
      }
    }
  });

  it('deterministyczne: ten sam stan daje ten sam wynik', () => {
    expect(beginChapterTwo(won, DEFAULT_BALANCE)).toEqual(result);
  });

  it('odmowa, gdy rozdział 1 nie jest wygrany albo to już rozdział 2', () => {
    const active = deepFreeze({ ...won, mission: { ...won.mission, status: 'active' as const } });
    expect(beginChapterTwo(active, DEFAULT_BALANCE)).toEqual({ ok: false, code: 'notWon' });
    expect(beginChapterTwo(next, DEFAULT_BALANCE)).toEqual({ ok: false, code: 'notWon' });
    const wonTwo = deepFreeze({ ...next, mission: { ...next.mission, status: 'won' as const } });
    expect(beginChapterTwo(wonTwo, DEFAULT_BALANCE)).toEqual({
      ok: false,
      code: 'notChapterOne',
    });
  });
});
