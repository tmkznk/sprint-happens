import { useGameSelector } from '../application/engineHooks';
import { useClearSelection, useSelection } from '../application/selectionHooks';
import { FURNITURE_CATALOG, type FurnitureId, type FurnitureType } from '../domain/furniture';

const FURNITURE_NAMES: Record<FurnitureType, string> = {
  desk: 'Stanowisko pracy',
  sofa: 'Kanapa',
  coffeeMachine: 'Ekspres do kawy',
};

// UX-01 (Z): dolny panel szczegółów wybranego obiektu. Pracownicy dołączą w SH-015.
export function SelectionPanel() {
  const selection = useSelection();
  const clear = useClearSelection();
  const id: FurnitureId | null = selection?.kind === 'furniture' ? selection.id : null;
  const furniture = useGameSelector((state) => (id ? state.world.furniture[id] : undefined));

  if (!furniture) return null;

  const places = FURNITURE_CATALOG[furniture.type].interactionPoints.length;
  return (
    <section className="selection-panel" aria-label="Szczegóły obiektu">
      <header>
        <h2>{FURNITURE_NAMES[furniture.type]}</h2>
        <button type="button" onClick={clear} aria-label="Zamknij">
          ✕
        </button>
      </header>
      <dl>
        <dt>Miejsca</dt>
        <dd>{places}</dd>
        <dt>Obrót</dt>
        <dd>{furniture.rotation}°</dd>
        <dt>Pozycja</dt>
        <dd>
          {furniture.origin.x}, {furniture.origin.y}
        </dd>
      </dl>
    </section>
  );
}
