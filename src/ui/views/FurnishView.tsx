import { Armchair, CodeXml, Coffee, Sprout, type LucideIcon } from 'lucide-react';
import { useBalanceConfig, useDispatch, useGameSelector } from '../../application/engineHooks';
import { useFurnitureEditStore } from '../../application/furnitureEditHooks';
import { useClearSelection } from '../../application/selectionHooks';
import { FURNITURE_CATALOG, type FurnitureType } from '../../domain/furniture';
import { FURNITURE_NAMES, money } from '../labels';
import { useNavigation } from '../navigation';
import { REJECTION_MESSAGES } from '../rejectionMessages';

const TYPES: FurnitureType[] = ['desk', 'sofa', 'coffeeMachine', 'plant'];

const ICONS: Record<FurnitureType, LucideIcon> = {
  desk: CodeXml,
  sofa: Armchair,
  coffeeMachine: Coffee,
  plant: Sprout,
};

const DESCRIPTIONS: Record<FurnitureType, string> = {
  desk: 'Stanowisko pracy — bez biurka nikt nie pracuje.',
  sofa: 'Regeneracja dla najbardziej zmęczonych.',
  coffeeMachine: 'Szybki zastrzyk energii między taskami.',
  plant: 'Dekoracja. Biuro od razu wygląda na mniej korpo.',
};

function places(type: FurnitureType): string {
  const count = FURNITURE_CATALOG[type].interactionPoints.length;
  return count === 0 ? 'dekoracja' : `miejsca: ${count}`;
}

// Zakładka „Urządź” (SH-033, wzór SH2). OFF-03 (Z): wybór wyposażenia, potem ustawienie w biurze
// w trybie edycji (OFF-07: pauza). Przesuwanie i sprzedaż — dotknięcie mebla w biurze.
export function FurnishView() {
  const config = useBalanceConfig();
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  const speed = useGameSelector((state) => state.mission.speed);
  const edit = useFurnitureEditStore();
  const clearSelection = useClearSelection();
  const dispatch = useDispatch();
  const { open } = useNavigation();

  const choose = (furnitureType: FurnitureType) => {
    if (speed !== 0) dispatch({ type: 'SetSpeed', speed: 0 });
    clearSelection();
    edit.set({ mode: 'buy', furnitureType, origin: { x: 4, y: 8 }, rotation: 0 });
    open('office');
  };

  return (
    <>
      <p className="hint">
        Wybierz mebel, a potem ustaw go w biurze. Gra jest wtedy wstrzymana. Aby przesunąć lub
        sprzedać mebel, dotknij go w biurze.
      </p>
      {!isWorking && <p className="alert">{REJECTION_MESSAGES.phaseNotAllowed}</p>}
      <ul className="shop-list">
        {TYPES.map((type) => {
          const Icon = ICONS[type];
          return (
            <li key={type}>
              <span className="candidate-name">
                <Icon size={16} aria-hidden="true" /> {FURNITURE_NAMES[type]}
              </span>
              <span>{DESCRIPTIONS[type]}</span>
              <span>
                {money.format(config.furniture.prices[type])} zł · {places(type)}
              </span>
              <button
                type="button"
                className="primary-button"
                disabled={!isWorking}
                onClick={() => choose(type)}
              >
                Wybierz
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
