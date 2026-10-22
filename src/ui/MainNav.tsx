import { Armchair, Briefcase, Building2, Flag, Users, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigation, type Tab } from './navigation';

const ITEMS: { tab: Tab; label: string; icon: ReactNode; className?: string }[] = [
  { tab: 'office', label: 'Biuro', icon: <Building2 size={22} /> },
  { tab: 'projects', label: 'Projekty', icon: <Briefcase size={22} /> },
  { tab: 'team', label: 'Zespół', icon: <Users size={22} /> },
  { tab: 'furnish', label: 'Urządź', icon: <Armchair size={22} /> },
  { tab: 'finance', label: 'Finanse', icon: <Wallet size={22} /> },
  { tab: 'goals', label: 'Cel misji', icon: <Flag size={22} />, className: 'nav-goals' },
];

// SH-033: dolna nawigacja na telefonie, kolumna po lewej na desktopie (wzór SH2).
export function MainNav() {
  const { tab, open } = useNavigation();
  const current = tab === 'recruit' ? 'team' : tab;
  return (
    <nav className="main-nav" aria-label="Nawigacja">
      {ITEMS.map((item) => (
        <button
          key={item.tab}
          type="button"
          className={item.className}
          aria-current={current === item.tab ? 'page' : undefined}
          onClick={() => open(item.tab)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
