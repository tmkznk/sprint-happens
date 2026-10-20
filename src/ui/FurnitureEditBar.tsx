import { useState } from 'react';
import { useDispatch, useGameSelector } from '../application/engineHooks';
import { useFurnitureEdit, useFurnitureEditStore } from '../application/furnitureEditHooks';
import { ROTATIONS, type Rotation } from '../domain/furniture';
import { validatePlacement } from '../simulation/furniture';
import { REJECTION_MESSAGES } from './rejectionMessages';

// UX-04 (Z): tryb „Urządź” — obrót, zatwierdzenie i anulowanie. Anulowanie przywraca poprzednie
// ustawienie (stan gry zmienia dopiero zatwierdzenie). Zablokowane ustawienie nie da się zatwierdzić.
export function FurnitureEditBar() {
  const edit = useFurnitureEdit();
  const store = useFurnitureEditStore();
  const dispatch = useDispatch();
  const [message, setMessage] = useState<string | null>(null);
  const problem = useGameSelector((state) =>
    edit ? validatePlacement(state, edit.furnitureId, edit.origin, edit.rotation) : null,
  );
  if (!edit) return null;

  const rotate = () => {
    const index = ROTATIONS.indexOf(edit.rotation);
    const rotation = ROTATIONS[(index + 1) % ROTATIONS.length] as Rotation;
    store.set({ ...edit, rotation });
  };
  const confirm = () => {
    const result = dispatch({ type: 'MoveFurniture', ...edit });
    if (result.ok) store.set(null);
    else setMessage(REJECTION_MESSAGES[result.rejection.code]);
  };

  return (
    <section className="selection-panel edit-bar" aria-label="Urządzanie">
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
          Zatwierdź
        </button>
      </div>
    </section>
  );
}
