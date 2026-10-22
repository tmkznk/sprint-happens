import type { ReactNode } from 'react';

// SH-033 (wzór SH2): pusty stan z jedną wyraźną akcją zamiast pustej listy.
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button type="button" className="primary-button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
