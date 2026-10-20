import { useState } from 'react';
import { useBalanceConfig, useDispatch, useGameSelector } from '../application/engineHooks';
import { useFurnitureEditStore } from '../application/furnitureEditHooks';
import { useClearSelection } from '../application/selectionHooks';
import { FURNITURE_CATALOG, type FurnitureType } from '../domain/furniture';
import { FURNITURE_NAMES, money } from './labels';

const TYPES: FurnitureType[] = ['desk', 'sofa', 'coffeeMachine'];

// OFF-03 (Z): zakup wyposażenia — wybór typu, potem ustawienie w trybie „Urządź” (pauza).
export function ShopButton() {
  const [open, setOpen] = useState(false);
  const config = useBalanceConfig();
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  const speed = useGameSelector((state) => state.mission.speed);
  const edit = useFurnitureEditStore();
  const clearSelection = useClearSelection();
  const dispatch = useDispatch();

  const choose = (furnitureType: FurnitureType) => {
    // OFF-07 (Z): edycja biura pauzuje symulację.
    if (speed !== 0) dispatch({ type: 'SetSpeed', speed: 0 });
    clearSelection();
    edit.set({ mode: 'buy', furnitureType, origin: { x: 4, y: 8 }, rotation: 0 });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="secondary-button"
        disabled={!isWorking}
        onClick={() => setOpen(true)}
      >
        Kup wyposażenie
      </button>
      {open && (
        <div className="modal-backdrop fullscreen">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="shop-title">
            <header className="modal-header">
              <h2 id="shop-title">Wyposażenie</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setOpen(false)}
                aria-label="Zamknij"
              >
                ✕
              </button>
            </header>
            <ul className="shop-list">
              {TYPES.map((type) => (
                <li key={type}>
                  <span className="candidate-name">{FURNITURE_NAMES[type]}</span>
                  <span>
                    {money.format(config.furniture.prices[type])} · miejsca:{' '}
                    {FURNITURE_CATALOG[type].interactionPoints.length}
                  </span>
                  <button type="button" onClick={() => choose(type)}>
                    Wybierz
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
