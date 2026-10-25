import { MapPin, UserPlus, Users } from 'lucide-react';
import { useBalanceConfig, useGameSelector } from '../../application/engineHooks';
import { useSelect } from '../../application/selectionHooks';
import { ENERGY_SCALE, SATISFACTION_SCALE, type Employee } from '../../domain/employees';
import { workStatus } from '../../simulation/assignments';
import { isUnhappy } from '../../simulation/satisfaction';
import { compareIds } from '../../simulation/staff';
import { Avatar } from '../Avatar';
import { EmptyState } from '../EmptyState';
import { FireEmployeeButton } from '../FireEmployeeButton';
import { money, SENIORITY_LABELS, SPECIALIZATION_LABELS, WORK_STATUS_LABELS } from '../labels';
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

// Kafelek pracownika (wzór kafelka kandydata): awatar, stanowisko, dniówka, projekt i problemy
// z pracą; akcje „Pokaż w biurze” i „Zwolnij”; paski energii i zadowolenia.
function TeamMember({ employee }: { employee: Employee }) {
  const config = useBalanceConfig();
  const { open } = useNavigation();
  const select = useSelect();
  const projectName = useGameSelector((state) =>
    employee.projectId ? (state.contracts.projects[employee.projectId]?.name ?? null) : null,
  );
  const status = useGameSelector((state) => {
    const current = state.staff.employees[employee.id];
    return current ? workStatus(state, current, config) : null;
  });
  const energy = Math.round(employee.energy / ENERGY_SCALE);
  const satisfaction = Math.round(employee.satisfaction / SATISFACTION_SCALE);

  return (
    <li className="team-member">
      <Avatar name={employee.name} specialization={employee.specialization} />
      <div className="candidate-info">
        <span className="candidate-name">{employee.name}</span>
        <span className="candidate-role">
          {SPECIALIZATION_LABELS[employee.specialization]} · {SENIORITY_LABELS[employee.seniority]}
        </span>
        <span className="candidate-wage">
          {money.format(employee.dailyWage)} zł / dzień · {projectName ?? 'bez przydziału'}
        </span>
        {status && status !== 'ready' && status !== 'noAssignment' && (
          <span className="warning">{WORK_STATUS_LABELS[status]}</span>
        )}
        {isUnhappy(employee, config) && <span className="negative">Chce odejść!</span>}
      </div>
      <div className="team-actions">
        <button
          type="button"
          className="secondary-button"
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
      </div>
      <div className="meters">
        <span>Energia</span>
        <progress max={100} value={energy} aria-label={`Energia: ${employee.name}`} />
        <span>{energy}%</span>
        <span>Zadowolenie</span>
        <progress max={100} value={satisfaction} aria-label={`Zadowolenie: ${employee.name}`} />
        <span>{satisfaction}</span>
      </div>
    </li>
  );
}
