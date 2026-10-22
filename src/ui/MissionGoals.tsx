import { useBalanceConfig, useGameSelector } from '../application/engineHooks';
import { money } from './labels';

// MIS-03 (Z): cele misji widoczne cały czas; spełnienie rozstrzyga silnik w rozliczeniu dnia
// (simulation/mission.ts). Panel wybiera wartości proste, aby nie tworzyć obiektu co odczyt.
export function MissionGoals() {
  const { victory } = useBalanceConfig().mission;
  const delivered = useGameSelector((state) => state.contracts.deliveredCount);
  const cash = useGameSelector((state) => state.finance.cash);
  const reputation = useGameSelector((state) => state.mission.reputation);
  const mark = (done: boolean) => (done ? ' ✓' : '');

  return (
    <p className="mission-goals" aria-label="Cele misji">
      Cele: projekty {delivered}/{victory.deliveredProjects}
      {mark(delivered >= victory.deliveredProjects)} · saldo ≥ {money.format(victory.cash)}
      {mark(cash >= victory.cash)} · reputacja ≥ {victory.reputation}
      {mark(reputation >= victory.reputation)}
    </p>
  );
}
