import { useSyncExternalStore } from 'react';
import type { SaveManager } from '../application/saveManager';

// T:SAVE-T03 — stan zapisu jest widoczny; błąd nigdy nie wygląda jak sukces.
export function SaveIndicator({ manager }: { manager: SaveManager }) {
  const status = useSyncExternalStore(manager.subscribe, manager.getStatus);

  switch (status.kind) {
    case 'saving':
      return <span className="save-indicator">Zapisywanie…</span>;
    case 'saved':
      return <span className="save-indicator">Zapisano</span>;
    case 'error':
      return (
        <span className="save-indicator save-error" role="alert">
          Nie udało się zapisać gry ({status.message}). Postęp od ostatniego zapisu może zostać
          utracony.
        </span>
      );
    default:
      return null;
  }
}
