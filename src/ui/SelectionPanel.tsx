import { Coffee } from 'lucide-react';
import { useState } from 'react';
import { useBalanceConfig, useDispatch, useGameSelector } from '../application/engineHooks';
import { useFurnitureEdit, useFurnitureEditStore } from '../application/furnitureEditHooks';
import { useClearSelection, useSelection } from '../application/selectionHooks';
import type { EmployeeId } from '../domain/employees';
import { FURNITURE_CATALOG, type FurnitureId, type FurnitureType } from '../domain/furniture';
import type { GameState } from '../domain/state';
import { furnitureUsers, salePrice } from '../simulation/furniture';
import { hasBadConditions, isUnhappy } from '../simulation/satisfaction';
import { compareIds } from '../simulation/staff';
import { ConfirmDialog } from './ConfirmDialog';
import { EmployeeBio, EmployeeHead, EmployeeNeeds, EmployeeStatus } from './EmployeeCard';
import { FireEmployeeButton } from './FireEmployeeButton';
import { FurnitureEditBar } from './FurnitureEditBar';
import { AGENT_STATUS_LABELS, FURNITURE_NAMES, money } from './labels';
import { ProjectSelect } from './ProjectSelect';
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
      {FURNITURE_CATALOG[furniture.type].interactionPoints.length > 0 && (
        <>
          <dt>Miejsca</dt>
          <dd>{FURNITURE_CATALOG[furniture.type].interactionPoints.length}</dd>
        </>
      )}
      <dt>Obrót</dt>
      <dd>{furniture.rotation}°</dd>
      {furniture.type === 'coffeeMachine' && (
        <dd className="full-row">
          <SupportCoffee />
        </dd>
      )}
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

// Karta pracownika w biurze — jak w zakładce Zespół (wzór SH2), z decyzjami: projekt, biurko,
// zwolnienie. Ostrzeżenia o złych warunkach, odejściu i ruchu — pod statusem.
function EmployeeDetails({ id }: { id: EmployeeId }) {
  const employee = useGameSelector((state) => state.staff.employees[id]);
  const clear = useClearSelection();
  if (!employee) return null;
  return (
    <section className="selection-panel employee-panel" aria-label={employee.name}>
      <EmployeeHead employee={employee}>
        <button type="button" className="panel-close" onClick={clear} aria-label="Zamknij">
          ✕
        </button>
      </EmployeeHead>
      <EmployeeBio employee={employee} />
      <EmployeeNeeds employee={employee} />
      <EmployeeStatus employeeId={employee.id} />
      <EmployeeAlerts employeeId={employee.id} />
      <div className="field">
        <span className="field-label">Przydział projektu</span>
        <span className="field-row">
          <ProjectSelect employeeId={employee.id} projectId={employee.projectId} />
          <FireEmployeeButton employeeId={employee.id} variant="icon" />
        </span>
      </div>
      <div className="field">
        <span className="field-label">Biurko</span>
        <span className="field-row">
          <DeskSelect employeeId={employee.id} deskId={employee.deskId} />
        </span>
      </div>
    </section>
  );
}

// NEED-03, NEED-05 (Z): złe warunki i czas do odejścia; MOVE: brak drogi lub blokada.
function EmployeeAlerts({ employeeId }: { employeeId: EmployeeId }) {
  const config = useBalanceConfig();
  const unhappy = useGameSelector((state) => {
    const current = state.staff.employees[employeeId];
    return current ? isUnhappy(current, config) : false;
  });
  const bad = useGameSelector((state) => {
    const current = state.staff.employees[employeeId];
    return current ? hasBadConditions(state, current, config) : false;
  });
  const minutesLeft = useGameSelector((state) => {
    const current = state.staff.employees[employeeId];
    if (!current) return 0;
    const left = config.satisfaction.quitAfterSeconds * 1000 - current.lowSatisfactionMs;
    return Math.max(1, Math.ceil(left / 60_000));
  });
  const movement = useGameSelector(
    (state) => state.world.movement.agents.find((agent) => agent.id === employeeId)?.status,
  );
  const blocked = movement === 'noRoute' || movement === 'deadlocked';
  if (!bad && !unhappy && !blocked) return null;
  return (
    <div className="employee-alerts">
      {bad && (
        <p className="warning">
          Złe warunki — brak biurka, wyczerpanie albo brak miejsca odpoczynku.
        </p>
      )}
      {unhappy && (
        <p className="negative" role="alert">
          Odejdzie za ok. {minutesLeft} min gry, jeśli zadowolenie nie wzrośnie powyżej{' '}
          {config.satisfaction.warningThreshold}.
        </p>
      )}
      {blocked && <p className="negative">{AGENT_STATUS_LABELS[movement]}</p>}
    </div>
  );
}

const SUPPORT_URL = 'https://buycoffee.to/tmkznk';

// Wsparcie autora przy ekspresie do kawy (link zewnętrzny, nowa karta, bez dostępu do gry).
function SupportCoffee() {
  return (
    <aside className="support-card">
      <p className="support-title">Podoba ci się gra?</p>
      <p>Ten ekspres działa na wirtualnej kawie. Autor — na prawdziwej.</p>
      <a
        className="primary-button support-button"
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Postaw mi kawę (otwiera się w nowej karcie)"
      >
        <Coffee size={16} aria-hidden="true" />
        Postaw mi kawę
      </a>
    </aside>
  );
}
