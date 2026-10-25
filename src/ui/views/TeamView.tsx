import { Heart, MapPin, UserPlus, Users, Zap } from 'lucide-react';
import { useBalanceConfig, useGameSelector } from '../../application/engineHooks';
import { useSelect } from '../../application/selectionHooks';
import { ENERGY_SCALE, SATISFACTION_SCALE, type Employee } from '../../domain/employees';
import type { BalanceConfig } from '../../domain/config';
import { bioFor } from '../../domain/content/bios';
import type { GameState } from '../../domain/state';
import { workStatus } from '../../simulation/assignments';
import { activityOf } from '../../simulation/needs';
import { isTesting } from '../../simulation/qa';
import { isWorking } from '../../simulation/work';
import { isUnhappy } from '../../simulation/satisfaction';
import { compareIds } from '../../simulation/staff';
import { Avatar } from '../Avatar';
import { EmptyState } from '../EmptyState';
import { FireEmployeeButton } from '../FireEmployeeButton';
import {
  ACTIVITY_LABELS,
  money,
  SENIORITY_LABELS,
  SPECIALIZATION_LABELS,
  WORK_STATUS_LABELS,
} from '../labels';
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
function TeamMember({ employee }: { employee: Employee }) {
  const config = useBalanceConfig();
  const { open } = useNavigation();
  const select = useSelect();
  // Selektor zwraca wartość prostą (useSyncExternalStore) — „ton|tekst”.
  const statusKey = useGameSelector((state) => {
    const current = state.staff.employees[employee.id];
    if (!current) return null;
    const { tone, text } = employeeStatus(state, current, config);
    return `${tone}|${text}`;
  });
  const [tone, text] = statusKey ? (statusKey.split('|') as [Tone, string]) : [null, null];
  const energy = Math.round(employee.energy / ENERGY_SCALE);
  const satisfaction = Math.round(employee.satisfaction / SATISFACTION_SCALE);

  return (
    <li className="employee-card">
      <div className="employee-head">
        <Avatar name={employee.name} specialization={employee.specialization} size={42} />
        <div className="employee-name">
          <h3>{employee.name}</h3>
          <p>
            {SPECIALIZATION_LABELS[employee.specialization]} ·{' '}
            {SENIORITY_LABELS[employee.seniority]}
          </p>
        </div>
        <strong className="employee-wage">
          {money.format(employee.dailyWage)} zł
          <small>/ dzień</small>
        </strong>
      </div>
      <p className="bio">{bioFor(employee)}</p>
      <div className="needs">
        <span>
          <span className="need-label">
            <Zap size={14} aria-hidden="true" /> Energia <b>{energy}%</b>
          </span>
          <span className="bar amber">
            <span style={{ width: `${energy}%` }} />
          </span>
        </span>
        <span>
          <span className="need-label">
            <Heart size={14} aria-hidden="true" /> Zadowolenie <b>{satisfaction}%</b>
          </span>
          <span className="bar">
            <span style={{ width: `${satisfaction}%` }} />
          </span>
        </span>
      </div>
      {text && (
        <p className={`employee-status ${tone}`}>
          <span className="status-dot" aria-hidden="true" />
          {text}
        </p>
      )}
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
}

type Tone = 'ok' | 'warn' | 'danger';

// EMP-04, EMP-07, NEED-05: jedna linia stanu — od najpilniejszego problemu do bieżącej czynności.
function employeeStatus(
  state: GameState,
  employee: Employee,
  config: BalanceConfig,
): { text: string; tone: Tone } {
  if (isUnhappy(employee, config))
    return { text: 'Chce odejść! Popraw warunki pracy.', tone: 'danger' };
  if (!employee.deskId) return { text: WORK_STATUS_LABELS.noDesk, tone: 'warn' };
  if (!employee.projectId) return { text: 'Czeka na projekt', tone: 'ok' };
  const work = workStatus(state, employee, config);
  if (work !== 'ready') return { text: WORK_STATUS_LABELS[work], tone: 'warn' };
  const working = isWorking(state, employee, config) || isTesting(state, employee, config);
  return { text: ACTIVITY_LABELS[activityOf(state, employee, working)], tone: 'ok' };
}
