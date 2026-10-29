import type { DayPhase } from '../domain/state';

// Etykiety fazy dnia na karcie dnia (TIME-02, TIME-08).
export const PHASE_LABELS: Record<DayPhase, string> = {
  arriving: 'Przychodzą do biura',
  working: 'Dzień pracy',
  leaving: 'Wychodzą z biura',
  workEnded: 'Koniec pracy',
  settled: 'Koniec pracy',
};

// Fazy, w których zegar biegnie i tempo jest dostępne.
export function isClockPhase(phase: DayPhase): boolean {
  return phase === 'arriving' || phase === 'working' || phase === 'leaving';
}
