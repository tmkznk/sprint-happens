import { useState } from 'react';
import { useBalanceConfig, useDispatch, useGameSelector } from '../application/engineHooks';
import { useFurnitureEdit, useFurnitureEditStore } from '../application/furnitureEditHooks';
import { useClearSelection, useSelection } from '../application/selectionHooks';
import type { ProjectId } from '../domain/contracts';
import { FURNITURE_CATALOG, type FurnitureId, type FurnitureType } from '../domain/furniture';
import type { GameState } from '../domain/state';
import { ENERGY_SCALE, type EmployeeId } from '../domain/employees';
import { workStatus } from '../simulation/assignments';
import { activityOf } from '../simulation/needs';
import { isTesting } from '../simulation/qa';
import { isWorking } from '../simulation/work';
import { furnitureUsers, salePrice } from '../simulation/furniture';
import { compareIds } from '../simulation/staff';
import { ConfirmDialog } from './ConfirmDialog';
import { FurnitureEditBar } from './FurnitureEditBar';
import {
  ACTIVITY_LABELS,
  AGENT_STATUS_LABELS,
  FURNITURE_NAMES,
  money,
  SENIORITY_LABELS,
  SPECIALIZATION_LABELS,
  WORK_STATUS_LABELS,
} from './labels';
import { REJECTION_MESSAGES } from './rejectionMessages';

// UX-01 (Z): dotknięcie pracownika lub mebla otwiera dolny panel szczegółów.
export function SelectionPanel() {
  const selection = useSelection();
  const edit = useFurnitureEdit();
  if (edit) return <FurnitureEditBar />;
  if (selection?.kind === 'furniture') return <FurnitureDetails id={selection.id} />;
  if (selection?.kind === 'employee') return <EmployeeDetails id={selection.id} />;
  return null;
}

function Panel({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const clear = useClearSelection();
  return (
    <section className="selection-panel" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <button type="button" onClick={clear} aria-label="Zamknij">
          ✕
        </button>
      </header>
      <dl>{children}</dl>
      {actions && <div className="panel-actions">{actions}</div>}
    </section>
  );
}

// Biurka numerowane w kolejności ID — czytelna nazwa zamiast identyfikatora.
function deskLabels(state: GameState): Map<string, string> {
  return new Map(
    Object.values(state.world.furniture)
      .filter((item) => item.type === 'desk')
      .sort((a, b) => compareIds(a.id, b.id))
      .map((desk, index) => [desk.id, `Stanowisko ${index + 1}`]),
  );
}

function FurnitureDetails({ id }: { id: FurnitureId }) {
  const furniture = useGameSelector((state) => state.world.furniture[id]);
  const owner = useGameSelector(
    (state) => Object.values(state.staff.employees).find((e) => e.deskId === id)?.name,
  );
  const usersCount = useGameSelector((state) => furnitureUsers(state, id).users.length);
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  const speed = useGameSelector((state) => state.mission.speed);
  const editStore = useFurnitureEditStore();
  const clear = useClearSelection();
  const dispatch = useDispatch();
  const [confirmingSale, setConfirmingSale] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!furniture) return null;

  // OFF-07 (Z): edycja mebli pauzuje symulację.
  const pause = () => {
    if (speed !== 0) dispatch({ type: 'SetSpeed', speed: 0 });
  };
  const startMove = () => {
    pause();
    clear();
    editStore.set({
      mode: 'move',
      furnitureId: id,
      origin: furniture.origin,
      rotation: furniture.rotation,
    });
  };
  const sell = () => {
    pause();
    const result = dispatch({ type: 'SellFurniture', furnitureId: id });
    setConfirmingSale(false);
    if (result.ok) clear();
    else setMessage(REJECTION_MESSAGES[result.rejection.code]);
  };
  const used = owner !== undefined || usersCount > 0;
  const effects = [
    owner &&
      `${owner} straci stanowisko i nie będzie mógł pracować do przydzielenia innego biurka.`,
    usersCount > 0 && 'Osoby korzystające z mebla przerwą korzystanie.',
  ].filter(Boolean);

  return (
    <Panel
      title={FURNITURE_NAMES[furniture.type]}
      actions={
        isWorking && (
          <>
            <button type="button" className="secondary-button" onClick={startMove}>
              Przenieś
            </button>
            <SaleButton item={furniture} onSell={() => (used ? setConfirmingSale(true) : sell())} />
            {message && <p className="warning">{message}</p>}
            {confirmingSale && (
              <ConfirmDialog
                title="Sprzedać używany mebel?"
                message={effects.join(' ')}
                confirmLabel="Sprzedaj"
                onCancel={() => setConfirmingSale(false)}
                onConfirm={sell}
              />
            )}
          </>
        )
      }
    >
      {furniture.type === 'desk' && (
        <>
          <dt>Przypisane do</dt>
          <dd>{owner ?? 'Wolne'}</dd>
        </>
      )}
      <dt>Miejsca</dt>
      <dd>{FURNITURE_CATALOG[furniture.type].interactionPoints.length}</dd>
      <dt>Obrót</dt>
      <dd>{furniture.rotation}°</dd>
    </Panel>
  );
}

function SaleButton({ item, onSell }: { item: { type: FurnitureType }; onSell(): void }) {
  const price = useSalePrice(item.type);
  return (
    <button type="button" className="secondary-button" onClick={onSell}>
      Sprzedaj (+{money.format(price)})
    </button>
  );
}

function useSalePrice(type: FurnitureType): number {
  const config = useBalanceConfig();
  return salePrice({ type }, config);
}

function DeskSelect({
  employeeId,
  deskId,
}: {
  employeeId: EmployeeId;
  deskId: FurnitureId | null;
}) {
  const labels = useGameSelector(deskLabelsKey);
  const takenBy = useGameSelector(takenDesksKey);
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  const dispatch = useDispatch();
  const [message, setMessage] = useState<string | null>(null);
  const options = labels
    .split('|')
    .filter(Boolean)
    .map((entry) => entry.split('=') as [string, string]);
  const taken = new Set(takenBy.split('|'));

  return (
    <>
      <select
        aria-label="Biurko"
        value={deskId ?? ''}
        disabled={!isWorking}
        onChange={(event) => {
          const value = event.target.value;
          const result = dispatch({
            type: 'AssignDesk',
            employeeId,
            deskId: value === '' ? null : (value as FurnitureId),
          });
          setMessage(result.ok ? null : REJECTION_MESSAGES[result.rejection.code]);
        }}
      >
        <option value="">Brak — nie może pracować</option>
        {options.map(([id, label]) => (
          <option key={id} value={id} disabled={id !== deskId && taken.has(id)}>
            {label}
            {id !== deskId && taken.has(id) ? ' (zajęte)' : ''}
          </option>
        ))}
      </select>
      {message && <span className="warning">{message}</span>}
    </>
  );
}

// Selektory zwracają tekst — stabilną wartość dla useSyncExternalStore.
function deskLabelsKey(state: GameState): string {
  return [...deskLabels(state)].map(([id, label]) => `${id}=${label}`).join('|');
}

function takenDesksKey(state: GameState): string {
  return Object.values(state.staff.employees)
    .map((e) => e.deskId ?? '')
    .join('|');
}

// EMP-05, EMP-07 (Z): przydział zmienia wyłącznie gracz; oddane projekty nie są dostępne.
function ProjectSelect({
  employeeId,
  projectId,
}: {
  employeeId: EmployeeId;
  projectId: ProjectId | null;
}) {
  const projects = useGameSelector((state) => state.contracts.projects);
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  const dispatch = useDispatch();
  const [message, setMessage] = useState<string | null>(null);
  const active = Object.values(projects).filter((project) => project.status === 'active');

  return (
    <>
      <select
        aria-label="Projekt"
        value={projectId ?? ''}
        disabled={!isWorking}
        onChange={(event) => {
          const value = event.target.value;
          const result = dispatch({
            type: 'AssignProject',
            employeeId,
            projectId: value === '' ? null : (value as ProjectId),
          });
          setMessage(result.ok ? null : REJECTION_MESSAGES[result.rejection.code]);
        }}
      >
        <option value="">Bez przydziału</option>
        {active.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      {message && <span className="warning">{message}</span>}
    </>
  );
}

function EmployeeDetails({ id }: { id: EmployeeId }) {
  const config = useBalanceConfig();
  const employee = useGameSelector((state) => state.staff.employees[id]);
  const status = useGameSelector(
    (state) => state.world.movement.agents.find((agent) => agent.id === id)?.status,
  );
  const work = useGameSelector((state) => {
    const current = state.staff.employees[id];
    return current ? workStatus(state, current, config) : null;
  });
  const activity = useGameSelector((state) => {
    const current = state.staff.employees[id];
    if (!current) return null;
    return activityOf(
      state,
      current,
      isWorking(state, current) || isTesting(state, current, config),
    );
  });
  const energy = useGameSelector((state) =>
    Math.round((state.staff.employees[id]?.energy ?? 0) / ENERGY_SCALE),
  );
  if (!employee) return null;
  return (
    <Panel title={employee.name}>
      <dt>Rola</dt>
      <dd>
        {SPECIALIZATION_LABELS[employee.specialization]} · {SENIORITY_LABELS[employee.seniority]}
      </dd>
      <dt>Pensja</dt>
      <dd>{money.format(employee.dailyWage)} / dzień</dd>
      <dt>Projekt</dt>
      <dd>
        <ProjectSelect employeeId={employee.id} projectId={employee.projectId} />
      </dd>
      <dt>Biurko</dt>
      <dd>
        <DeskSelect employeeId={employee.id} deskId={employee.deskId} />
      </dd>
      {work && (
        <>
          <dt>Praca</dt>
          <dd className={work === 'ready' ? undefined : 'warning'}>{WORK_STATUS_LABELS[work]}</dd>
        </>
      )}
      <dt>Energia</dt>
      <dd className="energy">
        <progress max={100} value={energy} aria-label="Energia" />
        <span className={energy <= 15 ? 'negative' : undefined}>{energy}%</span>
      </dd>
      {activity && (
        <>
          <dt>Teraz</dt>
          <dd className={activity === 'exhausted' ? 'negative' : undefined}>
            {ACTIVITY_LABELS[activity]}
          </dd>
        </>
      )}
      {(status === 'noRoute' || status === 'deadlocked') && (
        <>
          <dt>Ruch</dt>
          <dd className="negative">{AGENT_STATUS_LABELS[status]}</dd>
        </>
      )}
    </Panel>
  );
}
