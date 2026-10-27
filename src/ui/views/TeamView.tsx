import { MapPin, UserPlus, Users } from 'lucide-react';
import { memo } from 'react';
import { useGameSelector } from '../../application/engineHooks';
import { useSelect } from '../../application/selectionHooks';
import type { Employee } from '../../domain/employees';
import { compareIds } from '../../simulation/staff';
import { EmployeeBio, EmployeeHead, EmployeeNeeds, EmployeeStatus } from '../EmployeeCard';
import { sameEmployeeCard } from '../employeeDisplay';
import { EmptyState } from '../EmptyState';
import { FireEmployeeButton } from '../FireEmployeeButton';
import { money } from '../labels';
import { ProjectSelect } from '../ProjectSelect';
import { useNavigation } from '../navigation';
import { peopleCount } from '../plural';

// Zakładka „Zespół” (SH-033, wzór SH2): lista ludzi z kosztami, energią, zadowoleniem
// i statusem pracy (EMP-07); szczegóły i decyzje (projekt, biurko, zwolnienie) — w biurze.
export function TeamView() {
  const { open } = useNavigation();
  const employees = useGameSelector((state) => state.staff.employees);
  const list = Object.values(employees).sort((a, b) => compareIds(a.id, b.id));
  const wages = list.reduce((sum, e) => sum + e.dailyWage, 0);

  return (
    <>
      <div className="view-toolbar">
        <span>
          {peopleCount(list.length)} · {money.format(wages)} zł / dzień
        </span>
        <button type="button" className="primary-button" onClick={() => open('recruit')}>
          <UserPlus size={18} /> Rekrutuj
        </button>
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="Biuro czeka na ludzi"
          text="Zatrudnij pierwszą osobę i przydziel jej projekt."
          action={{ label: 'Poznaj kandydatów', onClick: () => open('recruit') }}
        />
      ) : (
        <ul className="team-list">
          {list.map((employee) => (
            <TeamMember key={employee.id} employee={employee} />
          ))}
        </ul>
      )}
    </>
  );
}

// Karta pracownika (wzór karty z SH2): awatar, stanowisko i dniówka; energia i zadowolenie
// obok siebie; status; przydział projektu z akcjami „Pokaż w biurze” i „Zwolnij”.
const TeamMember = memo(
  function TeamMember({ employee }: { employee: Employee }) {
    const { open } = useNavigation();
    const select = useSelect();

    return (
      <li className="employee-card">
        <EmployeeHead employee={employee} />
        <EmployeeBio employee={employee} />
        <EmployeeNeeds employee={employee} />
        <EmployeeStatus employeeId={employee.id} />
        <div className="field">
          <span className="field-label">Przydział projektu</span>
          <span className="field-row">
            <ProjectSelect employeeId={employee.id} projectId={employee.projectId} />
            <button
              type="button"
              className="secondary-button icon-only"
              aria-label={`Pokaż w biurze: ${employee.name}`}
              title="Pokaż w biurze"
              onClick={() => {
                select({ kind: 'employee', id: employee.id });
                open('office');
              }}
            >
              <MapPin size={18} />
            </button>
            <FireEmployeeButton employeeId={employee.id} variant="icon" />
          </span>
        </div>
      </li>
    );
  },
  (prev, next) => sameEmployeeCard(prev.employee, next.employee),
);
