import { useState } from 'react';
import { useBalanceConfig, useDispatch, useGameSelector } from '../application/engineHooks';
import { editCommand, editProblem } from '../application/furnitureEdit';
import { useFurnitureEdit, useFurnitureEditStore } from '../application/furnitureEditHooks';
import { ROTATIONS, type Rotation } from '../domain/furniture';
import { FURNITURE_NAMES, money } from './labels';
import { REJECTION_MESSAGES } from './rejectionMessages';

// UX-04 (Z): tryb „Urządź” — obrót, zatwierdzenie i anulowanie. Anulowanie przywraca poprzednie
// ustawienie (stan gry zmienia dopiero zatwierdzenie). Zablokowanego ustawienia lub zakupu bez
// środków nie da się zatwierdzić; cena jest pobierana dopiero przy zatwierdzeniu (SH-013).
export function FurnitureEditBar() {
  const edit = useFurnitureEdit();
  const store = useFurnitureEditStore();
  const config = useBalanceConfig();
  const dispatch = useDispatch();
  const [message, setMessage] = useState<string | null>(null);
  const problem = useGameSelector((state) => (edit ? editProblem(state, config, edit) : null));
  if (!edit) return null;

  const rotate = () => {
    const index = ROTATIONS.indexOf(edit.rotation);
    const rotation = ROTATIONS[(index + 1) % ROTATIONS.length] as Rotation;
    store.set({ ...edit, rotation });
  };
  const confirm = () => {
    const result = dispatch(editCommand(edit));
    if (result.ok) store.set(null);
    else setMessage(REJECTION_MESSAGES[result.rejection.code]);
  };

  return (
    <section className="selection-panel edit-bar" aria-label="Urządzanie">
      {edit.mode === 'buy' && (
        <h2>
          Zakup: {FURNITURE_NAMES[edit.furnitureType]} —{' '}
          {money.format(config.furniture.prices[edit.furnitureType])}
        </h2>
      )}
      <p>Dotknij podłogi, aby ustawić mebel. Gra jest wstrzymana.</p>
      {problem ? (
        <p className="warning" role="status">
          {REJECTION_MESSAGES[problem]}
        </p>
      ) : (
        message && <p className="warning">{message}</p>
      )}
      <div className="panel-actions">
        <button type="button" className="secondary-button" onClick={rotate}>
          Obróć
        </button>
        <button type="button" className="secondary-button" onClick={() => store.set(null)}>
          Anuluj
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={problem !== null}
          onClick={confirm}
        >
          {edit.mode === 'buy' ? 'Kup' : 'Zatwierdź'}
        </button>
      </div>
    </section>
  );
}
