import { useBalanceConfig, useGameSelector } from '../application/engineHooks';
import { money } from './labels';

const percent = (current: number, target: number) =>
  target <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((current / target) * 100)));

// MIS-03 (Z): trzy progi zwycięstwa z postępem; spełnienie rozstrzyga silnik w rozliczeniu dnia
// (simulation/mission.ts). Selektory zwracają wartości proste (useSyncExternalStore).
export function MissionGoals() {
  const { victory } = useBalanceConfig().mission;
  const delivered = useGameSelector((state) => state.contracts.deliveredCount);
  const cash = useGameSelector((state) => state.finance.cash);
  const reputation = useGameSelector((state) => state.mission.reputation);
  const goals = [
    {
      label: 'Oddane projekty',
      value: `${delivered} / ${victory.deliveredProjects}`,
      percent: percent(delivered, victory.deliveredProjects),
    },
    {
      label: 'Saldo',
      value: `${money.format(cash)} zł / ${money.format(victory.cash)} zł`,
      percent: percent(cash, victory.cash),
    },
    {
      label: 'Reputacja',
      value: `${reputation} / ${victory.reputation}`,
      percent: percent(reputation, victory.reputation),
    },
  ];
  return (
    <ul className="goal-list" aria-label="Cele misji">
      {goals.map((goal) => (
        <li key={goal.label}>
          <div>
            <span>{goal.label}</span>
            <strong>{goal.value}</strong>
          </div>
          <span className="bar">
            <span style={{ width: `${goal.percent}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
