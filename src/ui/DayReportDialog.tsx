import { useDispatch, useGameSelector } from '../application/engineHooks';

const numberFormat = new Intl.NumberFormat('pl-PL');

// TIME-03, TIME-08 (Z): raport po rozliczeniu i przejście do następnego dnia.
// Okno modalne nad sceną przechwytuje dotyk, więc gest nie trafia do biura (T:VIEW-03).
// Pozycje kosztów, przychodów i terminów dochodzą w SH-029.
export function DayReportDialog() {
  const report = useGameSelector((state) => state.mission.report);
  const status = useGameSelector((state) => state.mission.status);
  const dispatch = useDispatch();

  if (!report) return null;
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="day-report-title">
        <h2 id="day-report-title">Podsumowanie dnia {report.day}</h2>
        <dl>
          <dt>Saldo po rozliczeniu</dt>
          <dd>{numberFormat.format(report.cashAfterSettlement)}</dd>
        </dl>
        {status === 'active' && (
          <button type="button" onClick={() => dispatch({ type: 'StartNextDay' })}>
            Następny dzień
          </button>
        )}
      </section>
    </div>
  );
}
