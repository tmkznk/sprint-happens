import type { ProjectId } from './contracts';
import type { EmployeeId } from './employees';
import type { EntityId } from './ids';

// Rozdział 2 — Scrum (SH-054–SH-056). Stan zapisywany: sprint, decyzje gracza, trwające
// spotkanie, premia dnia po daily i aktywne karty retrospektywy.
export type RetroCardId = EntityId<'retroCard'>;

export type Sprint = {
  number: number;
  startDay: number;
  endDay: number;
  goalProjectId: ProjectId | null;
  // Cel rozliczony (premia albo kara) — dokładnie raz na sprint.
  goalSettled: boolean;
};

export type Ceremony = 'planning' | 'daily' | 'retro';

export type Meeting = {
  ceremony: Ceremony;
  // Chwila dnia (ms), do której trwa spotkanie; null — uczestnicy jeszcze się schodzą.
  untilMs: number | null;
  // Bezpiecznik: najpóźniejszy koniec spotkania (ms dnia).
  deadlineMs: number;
  participants: EmployeeId[];
};

export type ScrumState = {
  sprint: Sprint | null;
  // Liczba rozpoczętych sprintów (numeracja kolejnych).
  sprintsStarted: number;
  // Decyzje gracza zatrzymujące grę (jak zdarzenie): wybór celu, wybór karty.
  pendingGoal: boolean;
  pendingRetro: { offered: RetroCardId[] } | null;
  meeting: Meeting | null;
  // Ostatnia odbyta ceremonia (dzień i rodzaj) — dzisiejsze daily/planowanie i retro tylko raz.
  lastCeremony: { day: number; ceremony: Ceremony } | null;
  // Dzień, w którym uczestnicy daily mają premię (do końca dnia), i ich lista.
  dailyBonus: { day: number; employees: EmployeeId[] } | null;
  cards: RetroCardId[];
};

export function emptyScrum(): ScrumState {
  return {
    sprint: null,
    sprintsStarted: 0,
    pendingGoal: false,
    pendingRetro: null,
    meeting: null,
    lastCeremony: null,
    dailyBonus: null,
    cards: [],
  };
}
