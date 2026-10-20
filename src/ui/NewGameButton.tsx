import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

// SAVE-04 (Z): nowa misja wymaga potwierdzenia zastąpienia istniejącego zapisu.
export function NewGameButton({ onConfirm }: { onConfirm(): void }) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      <button type="button" className="secondary-button" onClick={() => setAsking(true)}>
        Nowa gra
      </button>
      {asking && (
        <ConfirmDialog
          title="Rozpocząć nową misję?"
          message="Obecny zapis zostanie zastąpiony. Tej operacji nie można cofnąć."
          confirmLabel="Nowa misja"
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            onConfirm();
          }}
        />
      )}
    </>
  );
}
