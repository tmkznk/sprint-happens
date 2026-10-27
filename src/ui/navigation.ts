import { createContext, use } from 'react';

// SH-033: zakładki interfejsu (wzór SH2). „Biuro” to widok główny ze sceną; pozostałe otwierają
// się nad nim (telefon: pełny ekran, desktop: panel z prawej), więc scena Phaser nie jest
// odmontowywana przy przełączaniu (T:VIEW-05).
export type Tab = 'office' | 'projects' | 'team' | 'recruit' | 'furnish' | 'finance' | 'goals';

export type Navigation = { tab: Tab; open(tab: Tab): void };

// Nowa gra: właściwa misja albo prolog (samouczek).
export type MissionKind = 'mission' | 'prologue';

export const NavigationContext = createContext<Navigation | null>(null);

export function useNavigation(): Navigation {
  const navigation = use(NavigationContext);
  if (!navigation) throw new Error('Brak NavigationContext');
  return navigation;
}
