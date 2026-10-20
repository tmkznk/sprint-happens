import { useDispatch, useGameSelector } from '../application/engineHooks';

// TIME-08 (Z): po zakończeniu pracy gracz przegląda dane i oddaje projekty, a następnie
// rozlicza dzień. Przycisk jest dostępny tylko w fazie końca pracy; silnik pilnuje tego niezależnie.
export function DayControls() {
  const phase = useGameSelector((state) => state.mission.phase);
  const dispatch = useDispatch();

  if (phase !== 'workEnded') return null;
  return (
    <div className="day-controls">
      <span>Koniec dnia pracy. Przejrzyj wyniki i oddaj gotowe projekty.</span>
      <button type="button" onClick={() => dispatch({ type: 'SettleDay' })}>
        Rozlicz dzień
      </button>
    </div>
  );
}
