import { useGameSelector } from '../application/engineHooks';
import { DAY_LENGTH_MS } from '../simulation/time';

export function DayClock() {
  const day = useGameSelector((state) => state.mission.day);
  const timeInDayMs = useGameSelector((state) => state.mission.timeInDayMs);
  const phase = useGameSelector((state) => state.mission.phase);
  const progress = Math.floor((timeInDayMs / DAY_LENGTH_MS) * 100);

  return (
    <div className="day-clock">
      <span>Dzień {day}</span>
      <progress max={100} value={progress} aria-label="Postęp dnia pracy" />
      {phase !== 'working' && <span>Koniec pracy</span>}
    </div>
  );
}
