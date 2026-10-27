import { Armchair, Briefcase, Building2, Flag, Lock, Users, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGameSelector } from '../application/engineHooks';
import { useNavigation, type Tab } from './navigation';
import { navTarget, tabLock } from './prologue/guide';
import { spotlight, useGuide } from './prologue/hooks';

const ITEMS: { tab: Tab; label: string; icon: ReactNode; className?: string }[] = [
  { tab: 'office', label: 'Biuro', icon: <Building2 size={22} /> },
  { tab: 'projects', label: 'Projekty', icon: <Briefcase size={22} /> },
  { tab: 'team', label: 'Zespół', icon: <Users size={22} /> },
  { tab: 'furnish', label: 'Urządź', icon: <Armchair size={22} /> },
  { tab: 'finance', label: 'Finanse', icon: <Wallet size={22} /> },
  { tab: 'goals', label: 'Cel misji', icon: <Flag size={22} />, className: 'nav-goals' },
];

// SH-033: dolna nawigacja na telefonie, kolumna po lewej na desktopie (wzór SH2).
// Prolog: zakładki zablokowane są widoczne jako nieaktywne (dotknięcie wyjaśnia warunek),
// a zakładka z czekającą czynnością jest podświetlona.
export function MainNav() {
  const { tab, open } = useNavigation();
  const current = tab === 'recruit' ? 'team' : tab;
  const locked = useGameSelector((state) =>
    ITEMS.filter((item) => tabLock(state, item.tab) !== null)
      .map((item) => item.tab)
      .join(','),
  ).split(',');
  const target = navTarget(useGuide(), tab);
  // Na telefonie „Cel misji” jest w nawigacji tylko w prologu (bieżące zadanie samouczka);
  // w zamian w prologu nie ma tam Finansów (mniej ikon w dolnym pasku).
  const prologue = useGameSelector((state) => state.prologue !== null);
  return (
    <nav className="main-nav" aria-label="Nawigacja">
      {ITEMS.map((item) => {
        const isLocked = locked.includes(item.tab);
        return (
          <button
            key={item.tab}
            type="button"
            className={spotlight(
              [
                item.className,
                isLocked ? 'nav-locked' : undefined,
                prologue && item.tab === 'goals' ? 'nav-prologue' : undefined,
                prologue && item.tab === 'finance' ? 'nav-prologue-hidden' : undefined,
              ]
                .filter(Boolean)
                .join(' ') || undefined,
              target === item.tab,
            )}
            aria-current={current === item.tab ? 'page' : undefined}
            aria-disabled={isLocked || undefined}
            onClick={() => open(item.tab)}
          >
            {isLocked ? <Lock size={22} /> : item.icon}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
