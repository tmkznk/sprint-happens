import { useGameSelector } from '../application/engineHooks';
import { useClearSelection, useSelection } from '../application/selectionHooks';
import type { EmployeeId } from '../domain/employees';
import { FURNITURE_CATALOG, type FurnitureId, type FurnitureType } from '../domain/furniture';
import { AGENT_STATUS_LABELS, money, SENIORITY_LABELS, SPECIALIZATION_LABELS } from './labels';

const FURNITURE_NAMES: Record<FurnitureType, string> = {
  desk: 'Stanowisko pracy',
  sofa: 'Kanapa',
  coffeeMachine: 'Ekspres do kawy',
};

// UX-01 (Z): dotknięcie pracownika lub mebla otwiera dolny panel szczegółów.
export function SelectionPanel() {
  const selection = useSelection();
  if (selection?.kind === 'furniture') return <FurnitureDetails id={selection.id} />;
  if (selection?.kind === 'employee') return <EmployeeDetails id={selection.id} />;
  return null;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
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
    </section>
  );
}

function FurnitureDetails({ id }: { id: FurnitureId }) {
  const furniture = useGameSelector((state) => state.world.furniture[id]);
  const owner = useGameSelector(
    (state) => Object.values(state.staff.employees).find((e) => e.deskId === id)?.name,
  );
  if (!furniture) return null;
  return (
    <Panel title={FURNITURE_NAMES[furniture.type]}>
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

function EmployeeDetails({ id }: { id: EmployeeId }) {
  const employee = useGameSelector((state) => state.staff.employees[id]);
  const status = useGameSelector(
    (state) => state.world.movement.agents.find((agent) => agent.id === id)?.status,
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
      <dt>Biurko</dt>
      <dd>{employee.deskId ? 'Przydzielone' : 'Brak — nie może pracować'}</dd>
      {status && (
        <>
          <dt>Teraz</dt>
          <dd className={status === 'noRoute' || status === 'deadlocked' ? 'negative' : undefined}>
            {AGENT_STATUS_LABELS[status]}
          </dd>
        </>
      )}
    </Panel>
  );
}
