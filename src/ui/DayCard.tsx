import { useDispatch, useGameSelector } from '../application/engineHooks';
import { DAY_LENGTH_MS } from '../simulation/time';
import { clockLabel } from './clock';
import { PHASE_LABELS } from './dayPhase';
import { spotlight, useGuide } from './prologue/hooks';
import { SpeedControls } from './SpeedControls';

// SH-033 (wzór SH2): numer dnia, godzina, postęp dnia i tempo (TIME-02); po pracy — rozliczenie
// (TIME-08: przycisk tylko w fazie końca pracy; silnik pilnuje tego niezależnie).
export function DayCard() {
  const day = useGameSelector((state) => state.mission.day);
  // Wartości wyświetlane, nie surowy czas — karta odświeża się raz na minutę gry, nie co krok.
  const clock = useGameSelector((state) => clockLabel(state.mission.timeInDayMs));
  const progress = useGameSelector((state) =>
    Math.floor((state.mission.timeInDayMs / DAY_LENGTH_MS) * 100),
  );
  const phase = useGameSelector((state) => state.mission.phase);
  const dispatch = useDispatch();
  const settle = useGuide()?.kind === 'settle';

  return (
    <section className="day-card" aria-label="Dzień pracy">
      <span className="day-number">{String(day).padStart(2, '0')}</span>
      <div className="day-info">
        <strong>Dzień {day}</strong>
        <span>
          {clock} · {PHASE_LABELS[phase]}
        </span>
      </div>
      <div className="day-progress">
        <div>
          <span>9:00</span>
          <span>17:00</span>
        </div>
        <progress max={100} value={progress} aria-label="Postęp dnia pracy" />
      </div>
      <SpeedControls />
      {phase === 'workEnded' && (
        <div className="day-controls">
          <span>Koniec dnia pracy. Przejrzyj wyniki i oddaj gotowe projekty.</span>
          <button
            type="button"
            className={spotlight('primary-button', settle)}
            onClick={() => dispatch({ type: 'SettleDay' })}
          >
            Rozlicz dzień
          </button>
        </div>
      )}
    </section>
  );
}
