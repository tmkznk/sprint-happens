import { Heart, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { useBalanceConfig, useGameSelector } from '../application/engineHooks';
import type { BalanceConfig } from '../domain/config';
import { personById } from '../domain/content/people';
import type { Employee, EmployeeId } from '../domain/employees';
import type { GameState } from '../domain/state';
import { workStatus } from '../simulation/assignments';
import { activityOf } from '../simulation/needs';
import { isTesting } from '../simulation/qa';
import { isUnhappy } from '../simulation/satisfaction';
import { isWorking } from '../simulation/work';
import { Avatar } from './Avatar';
import { energyPercent, satisfactionPercent } from './employeeDisplay';
import {
  ACTIVITY_LABELS,
  money,
  SENIORITY_LABELS,
  SPECIALIZATION_LABELS,
  WORK_STATUS_LABELS,
} from './labels';

// Wspólne części karty pracownika (wzór karty z SH2) — zakładka Zespół i panel w biurze.

// Nagłówek: awatar, imię, stanowisko · poziom, dniówka; `children` — np. przycisk zamknięcia.
export function EmployeeHead({ employee, children }: { employee: Employee; children?: ReactNode }) {
  return (
    <div className="employee-head">
      <Avatar person={employee} size={42} />
      <div className="employee-name">
        <h3>{employee.name}</h3>
        <p>
          {SPECIALIZATION_LABELS[employee.specialization]} · {SENIORITY_LABELS[employee.seniority]}
        </p>
      </div>
      <strong className="employee-wage">
        {money.format(employee.dailyWage)} zł
        <small>/ dzień</small>
      </strong>
      {children}
    </div>
  );
}

export function EmployeeBio({ employee }: { employee: Employee }) {
  return <p className="bio">{personById(employee.personId)?.bio}</p>;
}

// NEED-01, NEED-03: energia i zadowolenie obok siebie.
export function EmployeeNeeds({ employee }: { employee: Employee }) {
  const energy = energyPercent(employee);
  const satisfaction = satisfactionPercent(employee);
  return (
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
  );
}

type Tone = 'ok' | 'warn' | 'danger';

// EMP-04, EMP-07, NEED-05: jedna linia stanu — od najpilniejszego problemu do bieżącej czynności.
export function EmployeeStatus({ employeeId }: { employeeId: EmployeeId }) {
  const config = useBalanceConfig();
  // Selektor zwraca wartość prostą (useSyncExternalStore) — „ton|tekst”.
  const statusKey = useGameSelector((state) => {
    const current = state.staff.employees[employeeId];
    if (!current) return null;
    const { tone, text } = employeeStatus(state, current, config);
    return `${tone}|${text}`;
  });
  if (!statusKey) return null;
  const [tone, text] = statusKey.split('|') as [Tone, string];
  return (
    <p className={`employee-status ${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {text}
    </p>
  );
}

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
