import { Check } from 'lucide-react';
import { useBalanceConfig, useGameSelector } from '../application/engineHooks';
import { money } from './labels';
import { projectsCount } from './plural';
import { SprintPanel } from './SprintPanel';

// MIS-03 (Z): trzy progi zwycięstwa jako punkty, jak cele prologu, z bieżącą wartością; progi
// obowiązują naraz, więc każdy niespełniony jest bieżący. Zwycięstwo rozstrzyga silnik
// w rozliczeniu dnia (simulation/mission.ts). Selektory zwracają wartości proste.
export function MissionGoals() {
  const chapter = useGameSelector((state) => state.mission.chapter);
  const victory = useBalanceConfig().mission.victory[chapter];
  const delivered = useGameSelector((state) => state.contracts.chapterDeliveredCount);
  const cash = useGameSelector((state) => state.finance.cash);
  const reputation = useGameSelector((state) => state.mission.reputation);
  const goals = [
    {
      label: `Oddać ${projectsCount(victory.deliveredProjects)}.`,
      value: `${delivered} / ${victory.deliveredProjects}`,
      done: delivered >= victory.deliveredProjects,
    },
    {
      label: `Mieć ${money.format(victory.cash)}\u00a0zł.`,
      value: `${money.format(cash)} zł`,
      done: cash >= victory.cash,
    },
    {
      label: `Zbudować reputację ${victory.reputation}.`,
      value: `${reputation} / ${victory.reputation}`,
      done: reputation >= victory.reputation,
    },
  ];
  return (
    <>
      <ol className="prologue-goals" aria-label="Cele misji">
        {goals.map((goal, index) => (
          <li key={goal.label} className={goal.done ? 'done' : 'current'}>
            <span className="prologue-goal-mark" aria-hidden="true">
              {goal.done ? <Check size={12} /> : index + 1}
            </span>
            <span>
              {goal.label}
              {goal.done && <span className="visually-hidden"> (spełnione)</span>}
            </span>
            <span className="goal-value">{goal.value}</span>
          </li>
        ))}
      </ol>
      {/* SH-058: sprint w rozdziale 2. */}
      <SprintPanel />
    </>
  );
}
