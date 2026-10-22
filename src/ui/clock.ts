import { DAY_LENGTH_MS } from '../simulation/time';

// Dzień pracy na zegarze biura: 600 s gry = 9:00–17:00 (prezentacja; silnik liczy ms dnia).
const START_MINUTES = 9 * 60;
const WORK_MINUTES = 8 * 60;

export function clockLabel(timeInDayMs: number): string {
  const minutes = START_MINUTES + Math.floor((timeInDayMs / DAY_LENGTH_MS) * WORK_MINUTES);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}
