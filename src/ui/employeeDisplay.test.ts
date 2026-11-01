import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { ENERGY_SCALE, SATISFACTION_SCALE } from '../domain/employees';
import { createPlayer } from '../test/player';
import { PEOPLE } from '../domain/content/people';
import { sameEmployeeCard, smokingLabel } from './employeeDisplay';

function employee() {
  const player = createPlayer(DEFAULT_BALANCE, 1);
  const id = player.hire('frontend', 'junior');
  const hired = player.state().staff.employees[id];
  if (!hired) throw new Error('brak pracownika');
  return hired;
}

describe('sameEmployeeCard', () => {
  it('zmiana poniżej pełnego procenta nie zmienia karty', () => {
    const a = employee();
    expect(sameEmployeeCard(a, { ...a, energy: a.energy - ENERGY_SCALE * 0.1 })).toBe(true);
  });

  it('zmiana widocznego procenta, projektu lub biurka zmienia kartę', () => {
    const a = employee();
    expect(sameEmployeeCard(a, { ...a, energy: a.energy - ENERGY_SCALE * 2 })).toBe(false);
    expect(
      sameEmployeeCard(a, { ...a, satisfaction: a.satisfaction - SATISFACTION_SCALE * 2 }),
    ).toBe(false);
    expect(sameEmployeeCard(a, { ...a, deskId: null, projectId: null })).toBe(
      a.deskId === null && a.projectId === null,
    );
  });
});

describe('smokingLabel', () => {
  it('pokazuje liczbę papierosów dziennie palaczowi', () => {
    const smoker = PEOPLE.find((person) => person.cigarettesPerDay > 0);
    if (!smoker) throw new Error('brak palacza');
    expect(smokingLabel(smoker.id)).toBe(`Pali: ${smoker.cigarettesPerDay} dziennie`);
  });

  it('niepalący i nieznana osoba nie mają wiersza', () => {
    const nonSmoker = PEOPLE.find((person) => person.cigarettesPerDay === 0);
    if (!nonSmoker) throw new Error('brak niepalącego');
    expect(smokingLabel(nonSmoker.id)).toBeNull();
    expect(smokingLabel('nie-ma-takiej')).toBeNull();
  });
});
