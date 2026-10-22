import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

// SH-033 (wzór SH2): zakładka zarządzania nad biurem — pełny ekran na telefonie, panel z prawej
// z rozmyciem tła na desktopie. Tło przechwytuje dotyk, więc nie trafia on do sceny (T:VIEW-03).
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="sheet-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <header className="sheet-header">
          <div>
            <p className="kicker">Sprint Happens! / Zarządzanie</p>
            <h2 id="sheet-title">{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zamknij">
            <X size={24} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}
