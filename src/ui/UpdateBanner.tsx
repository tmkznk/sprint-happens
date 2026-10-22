import { useState, useSyncExternalStore } from 'react';
import type { SaveManager } from '../application/saveManager';
import { saveAndUpdate } from '../application/update';
import { pwa } from '../pwa/register';
import type { Engine } from '../simulation/engine';

// T:PWA-T02 (Z): nowa wersja nie przeładowuje gry sama — gracz wybiera „Później” albo
// „Zapisz i zaktualizuj”. Błąd zapisu jest widoczny i wstrzymuje aktualizację.
export function UpdateBanner({ engine, manager }: { engine: Engine; manager: SaveManager }) {
  const instance = pwa();
  const status = useSyncExternalStore(instance.subscribe, instance.getStatus);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!status.updateWaiting || dismissed) return null;

  const update = async () => {
    setBusy(true);
    const result = await saveAndUpdate(engine, manager, () => instance.applyUpdate());
    if (result === 'saveFailed') {
      setMessage('Nie udało się zapisać gry — aktualizacja wstrzymana. Spróbuj ponownie.');
      setBusy(false);
    } else if (result === 'noUpdate') {
      setMessage('Aktualizacja jest już niedostępna.');
      setBusy(false);
    }
  };

  return (
    <div className="update-banner" role="status">
      <p>Dostępna nowa wersja gry.</p>
      {message && <p className="warning">{message}</p>}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={() => setDismissed(true)}>
          Później
        </button>
        <button type="button" disabled={busy} onClick={() => void update()}>
          {busy ? 'Zapisywanie…' : 'Zapisz i zaktualizuj'}
        </button>
      </div>
    </div>
  );
}
