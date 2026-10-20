import { useBalanceConfig, useGameSelector } from '../application/engineHooks';
import { forecastCash } from '../simulation/finance';

const money = new Intl.NumberFormat('pl-PL');

// FIN-08 (Z): saldo i prognoza po dzisiejszych pensjach i utrzymaniu, bez przyszłych oddań.
// Obie wartości liczy silnik; panel tylko je wyświetla.
export function FinanceSummary() {
  const config = useBalanceConfig();
  const cash = useGameSelector((state) => state.finance.cash);
  const forecast = useGameSelector((state) => forecastCash(state, config).afterSettlement);

  return (
    <div className="finance-summary">
      <span>
        Saldo <strong className={cash < 0 ? 'negative' : undefined}>{money.format(cash)}</strong>
      </span>
      <span title="Saldo po dzisiejszych pensjach i kosztach biura">
        Po rozliczeniu{' '}
        <strong className={forecast < 0 ? 'negative' : undefined}>{money.format(forecast)}</strong>
      </span>
    </div>
  );
}
