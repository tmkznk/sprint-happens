import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

// SAVE-04 (Z): nowa misja (lub prolog) wymaga potwierdzenia zastąpienia istniejącego zapisu.
export function NewGameButton({
  onConfirm,
  label = 'Nowa gra',
  title = 'Rozpocząć nową misję?',
  confirmLabel = 'Nowa misja',
}: {
  onConfirm(): void;
  label?: string;
  title?: string;
  confirmLabel?: string;
}) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      <button type="button" className="secondary-button" onClick={() => setAsking(true)}>
        {label}
      </button>
      {asking && (
        <ConfirmDialog
          title={title}
          message="Obecny zapis zostanie zastąpiony. Tej operacji nie można cofnąć."
          confirmLabel={confirmLabel}
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
