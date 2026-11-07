import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

// SH-033 (wzór SH2): zakładka zarządzania nad biurem — pełny ekran na telefonie, panel z prawej
// z rozmyciem tła na desktopie. Tło przechwytuje dotyk, więc nie trafia on do sceny (T:VIEW-03).
// `fullWidth` — na desktopie cały obszar biura zamiast panelu z prawej (np. „Zasady gry”).
export function Sheet({
  title,
  kicker = 'Sprint Happens! / Zarządzanie',
  fullWidth = false,
  onClose,
  children,
}: {
  title: string;
  kicker?: string | undefined;
  fullWidth?: boolean;
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
      className={fullWidth ? 'sheet-backdrop sheet-full' : 'sheet-backdrop'}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <header className="sheet-header">
          <div>
            <p className="kicker">{kicker}</p>
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
