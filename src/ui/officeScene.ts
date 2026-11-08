import { OFFICE_SCENES } from '../domain/content/events';
import type { Ceremony } from '../domain/scrum';
import type { GameState } from '../domain/state';

const SCENE_PERIOD_MS = 120_000;
const SCENE_VISIBLE_MS = 20_000;

// EVT-01 (Z): scenki biurowe bez decyzji i bez skutków — czysto prezentacyjne, wyliczane z dnia
// i chwili dnia (bez stanu, więc nie trafiają do zapisu i nie zależą od tempa).
// Tylko w fazie pracy: w 'leaving'/'workEnded' (np. o 17:00, reszta 0) biuro jest już puste.
// SH-058: w trakcie spotkania Scruma pasek mówi, co się dzieje przy stole.
const MEETING_TEXT: Record<Ceremony, string> = {
  planning: 'Planowanie sprintu. Estymacja zespołowa — termin i tak już sprzedany.',
  daily: 'Daily przy stole konferencyjnym. Co wczoraj, co dziś, co blokuje.',
  retro: 'Retrospektywa. Karteczki: co poszło dobrze, co źle i kto przyniesie pączki.',
};

export function officeSceneText(state: GameState): string | null {
  if (state.mission.phase !== 'working') return null;
  const ceremony = state.scrum?.meeting?.ceremony;
  if (ceremony) return MEETING_TEXT[ceremony];
  if (Object.keys(state.staff.employees).length === 0) return null;
  const { day, timeInDayMs } = state.mission;
  const slot = Math.floor(timeInDayMs / SCENE_PERIOD_MS);
  if (timeInDayMs % SCENE_PERIOD_MS >= SCENE_VISIBLE_MS || slot === 0) return null;
  return OFFICE_SCENES[(day * 3 + slot) % OFFICE_SCENES.length] ?? null;
}
