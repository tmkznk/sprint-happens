import { useBalanceConfig, useGameSelector } from '../application/engineHooks';
import { SATISFACTION_SCALE } from '../domain/employees';

// NEED-05, EMP-08 (Z): ostrzeżenia o niezadowolonych i dzisiejsze samodzielne odejścia —
// gracz ma czas na reakcję i wie, dlaczego zespół się zmniejszył.
export function StaffAlerts() {
  const { warningThreshold } = useBalanceConfig().satisfaction;
  const unhappy = useGameSelector((state) =>
    Object.values(state.staff.employees)
      .filter((e) => e.satisfaction < warningThreshold * SATISFACTION_SCALE)
      .map((e) => e.name)
      .join(', '),
  );
  const quit = useGameSelector((state) =>
    state.staff.departures
      .filter((d) => d.reason === 'quit' && d.day === state.mission.day)
      .map((d) => d.name)
      .join(', '),
  );
  if (!unhappy && !quit) return null;
  return (
    <div className="staff-alerts" role="status">
      {unhappy && <p className="negative">Chcą odejść: {unhappy}</p>}
      {quit && <p className="warning">Odeszli dziś z firmy: {quit}</p>}
    </div>
  );
}
