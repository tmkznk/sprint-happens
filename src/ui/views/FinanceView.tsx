import { useBalanceConfig, useGameSelector } from '../../application/engineHooks';
import { forecastCash } from '../../simulation/finance';
import { money } from '../labels';

const signed = (value: number) => `${value < 0 ? '−' : '+'}${money.format(Math.abs(value))} zł`;

// Zakładka „Finanse” (SH-033, wzór SH2). FIN-08 (Z): saldo i prognoza po dzisiejszych pensjach
// i utrzymaniu liczy silnik; panel tylko wyświetla. FIN-05: okres ratunkowy widoczny.
export function FinanceView() {
  const config = useBalanceConfig();
  const cash = useGameSelector((state) => state.finance.cash);
  const forecast = useGameSelector((state) => forecastCash(state, config).afterSettlement);
  const rescueDeadline = useGameSelector((state) => state.finance.rescueDeadlineDay);
  const day = useGameSelector((state) => state.mission.day);
  const income = useGameSelector((state) =>
    state.finance.ledger
      .filter((e) => e.day === state.mission.day && e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0),
  );
  const spending = useGameSelector((state) =>
    state.finance.ledger
      .filter((e) => e.day === state.mission.day && e.amount < 0)
      .reduce((sum, e) => sum + e.amount, 0),
  );
  const wagesDue = useGameSelector((state) =>
    Object.values(state.finance.wagesDueToday).reduce((sum, wage) => sum + wage, 0),
  );
  const report = useGameSelector((state) => state.mission.report);

  return (
    <>
      <section className="balance-card">
        <span>Aktualne saldo</span>
        <strong className={cash < 0 ? 'negative' : undefined}>{money.format(cash)} zł</strong>
        <span>
          Prognoza po dzisiejszych kosztach:{' '}
          <b className={forecast < 0 ? 'negative' : undefined}>{money.format(forecast)} zł</b>
        </span>
      </section>
      {rescueDeadline !== null && (
        <p className="alert danger" role="status">
          Okres ratunkowy: saldo musi wrócić do co najmniej zera do rozliczenia dnia{' '}
          {rescueDeadline}. Do tego czasu nie można zatrudniać ani kupować wyposażenia.
        </p>
      )}
      <ul className="rows" aria-label={`Dzień ${day}`}>
        <li>
          Przychody dzisiaj <strong>{signed(income)}</strong>
        </li>
        <li>
          Zakupy i inne wydatki <strong>{signed(spending)}</strong>
        </li>
        <li>
          Pełne dniówki (w rozliczeniu) <strong>{signed(-wagesDue)}</strong>
        </li>
        <li>
          Utrzymanie biura (w rozliczeniu){' '}
          <strong>{signed(-config.finance.officeUpkeepPerDay)}</strong>
        </li>
      </ul>
      {report && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Rozliczenie dnia {report.day}</h3>
          <ul className="rows">
            <li>
              Wpływy <strong>{signed(report.income)}</strong>
            </li>
            <li>
              Pensje <strong>{signed(-report.wages)}</strong>
            </li>
            <li>
              Saldo po rozliczeniu <strong>{money.format(report.cashAfterSettlement)} zł</strong>
            </li>
          </ul>
        </section>
      )}
    </>
  );
}
