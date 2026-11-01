import { personById, type PersonId } from '../domain/content/people';
import { ENERGY_SCALE, SATISFACTION_SCALE, type Employee } from '../domain/employees';

export const energyPercent = (employee: Employee) => Math.round(employee.energy / ENERGY_SCALE);
export const satisfactionPercent = (employee: Employee) =>
  Math.round(employee.satisfaction / SATISFACTION_SCALE);

// Silnik zmienia energię i zadowolenie w każdym kroku, a karta pokazuje pełne procenty — karta
// renderuje się ponownie tylko przy zmianie tego, co widać (status ma własny selektor).
export function sameEmployeeCard(a: Employee, b: Employee): boolean {
  return (
    a === b ||
    (a.id === b.id &&
      a.personId === b.personId &&
      a.name === b.name &&
      a.specialization === b.specialization &&
      a.seniority === b.seniority &&
      a.dailyWage === b.dailyWage &&
      a.projectId === b.projectId &&
      a.deskId === b.deskId &&
      energyPercent(a) === energyPercent(b) &&
      satisfactionPercent(a) === satisfactionPercent(b))
  );
}

// Nałóg jest stały dla osoby, więc karta nie potrzebuje selektora. Tylko dla zatrudnionych —
// CV kandydata go nie ujawnia (gracz dowiaduje się po zatrudnieniu).
export function smokingLabel(personId: PersonId): string | null {
  const perDay = personById(personId)?.cigarettesPerDay ?? 0;
  return perDay > 0 ? `Pali: ${perDay} dziennie` : null;
}
