import type { RetroCard } from '../domain/content/retroCards';
import type { Ceremony, Sprint } from '../domain/scrum';

// SH-058: teksty Scruma w interfejsie (czyste funkcje — selektory zwracają z nich teksty).

export function sprintDayLabel(sprint: Sprint, day: number): string {
  const length = sprint.endDay - sprint.startDay + 1;
  return `Sprint ${sprint.number} · dzień ${day - sprint.startDay + 1}/${length}`;
}

export function goalLabel(sprint: Sprint, projectName: string | null): string {
  if (sprint.goalProjectId === null || projectName === null) return 'Bez celu';
  return sprint.goalSettled ? `Cel osiągnięty: ${projectName}` : `Cel: ${projectName}`;
}

export function cardSummary(card: Pick<RetroCard, 'plus' | 'minus'>): string {
  return `${card.plus} · ${card.minus}`;
}

const CEREMONY_LABELS: Record<Ceremony, string> = {
  daily: 'Na daily',
  planning: 'Na planowaniu',
  retro: 'Na retro',
};

export function ceremonyLabel(ceremony: Ceremony): string {
  return CEREMONY_LABELS[ceremony];
}

export function scrumHint(ready: {
  scrumMaster: boolean;
  scrumMasterDesk: boolean;
  table: boolean;
}): string {
  if (!ready.scrumMaster && !ready.table) {
    return 'Sprinty ruszą, gdy zatrudnisz Scrum Mastera i postawisz stół konferencyjny.';
  }
  if (!ready.scrumMaster) return 'Zatrudnij Scrum Mastera — bez niego nie ma ceremonii.';
  if (!ready.scrumMasterDesk) return 'Scrum Master potrzebuje biurka.';
  if (!ready.table) return 'Postaw stół konferencyjny — ceremonie odbywają się przy nim.';
  return 'Pierwszy sprint zacznie się następnego dnia.';
}
