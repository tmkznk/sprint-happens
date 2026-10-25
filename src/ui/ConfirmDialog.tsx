import { ModalLayer } from './ModalLayer';

// Okno potwierdzenia nad całym ekranem; tło przechwytuje dotyk (T:VIEW-03).
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  return (
    <ModalLayer>
      <div className="modal-backdrop">
        <section
          className="modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
        >
          <h2 id="confirm-title">{title}</h2>
          <p id="confirm-message">{message}</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              Anuluj
            </button>
            <button type="button" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </section>
      </div>
    </ModalLayer>
  );
}
