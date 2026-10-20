import { useDispatch, useGameSelector } from '../application/engineHooks';
import { money } from './labels';

// TIME-03, TIME-08 (Z): raport po rozliczeniu i przejście do następnego dnia.
// FIN-05 (Z): ujemne saldo uruchamia ostrzeżenie z terminem odzyskania płynności; brak poprawy
// kończy misję bankructwem. Okno modalne przechwytuje dotyk (T:VIEW-03).
export function DayReportDialog() {
  const report = useGameSelector((state) => state.mission.report);
  const status = useGameSelector((state) => state.mission.status);
  const dispatch = useDispatch();

  if (!report) return null;
  const bankrupt = status === 'bankrupt';
  const daysLeft = report.rescueDeadlineDay === null ? null : report.rescueDeadlineDay - report.day;

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="day-report-title">
        <h2 id="day-report-title">{bankrupt ? 'Bankructwo' : `Podsumowanie dnia ${report.day}`}</h2>
        <dl>
          <dt>Wpływy</dt>
          <dd>+{money.format(report.income)}</dd>
          <dt>Zakupy i inne wydatki</dt>
          <dd>−{money.format(report.spending)}</dd>
          <dt>Pensje</dt>
          <dd>−{money.format(report.wages)}</dd>
          <dt>Utrzymanie biura</dt>
          <dd>−{money.format(report.upkeep)}</dd>
          <dt>Saldo po rozliczeniu</dt>
          <dd className={report.cashAfterSettlement < 0 ? 'negative' : undefined}>
            {money.format(report.cashAfterSettlement)}
          </dd>
        </dl>
        {bankrupt ? (
          <p className="warning" role="alert">
            Firma nie odzyskała płynności w okresie ratunkowym. Misja zakończona — rozpocznij nową
            grę.
          </p>
        ) : (
          daysLeft !== null && (
            <p className="warning" role="alert">
              Ujemne saldo! Odzyskaj płynność do rozliczenia dnia {report.rescueDeadlineDay}
              {daysLeft === 0 ? '.' : ` (pozostało dni: ${daysLeft}).`} Do tego czasu nie można
              zatrudniać ani kupować wyposażenia.
            </p>
          )
        )}
        {status === 'active' && (
          <button type="button" onClick={() => dispatch({ type: 'StartNextDay' })}>
            Następny dzień
          </button>
        )}
      </section>
    </div>
  );
}
