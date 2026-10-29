import { Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBalanceConfig, useGameSelector } from '../application/engineHooks';
import { useOrderFeedback } from '../application/orderFeedbackHooks';
import { useClearSelection } from '../application/selectionHooks';
import { ENERGY_SCALE, type EmployeeId } from '../domain/employees';
import { activityOf } from '../simulation/needs';
import { isTesting } from '../simulation/qa';
import { isWorking } from '../simulation/work';
import { Avatar } from './Avatar';
import { ACTIVITY_LABELS } from './labels';
import {
  ORDER_REJECTION_MS,
  orderRejectionMessage,
  roleLabel,
  visibleRejection,
} from './selectionStripModel';

// F:UX-01 — pasek zaznaczonej postaci na dole sceny: kto to, co robi, energia; rozkazy wydaje się
// dotykiem celu na scenie, a pasek pokazuje odmowę. Niski, żeby nie zasłaniał biura.
// Selektory zwracają wartości proste — pasek renderuje się tylko przy zmianie tego, co widać.
export function SelectionStrip({ id, onExpand }: { id: EmployeeId; onExpand(): void }) {
  const config = useBalanceConfig();
  const clear = useClearSelection();
  const name = useGameSelector((state) => state.staff.employees[id]?.name ?? '');
  const personId = useGameSelector((state) => state.staff.employees[id]?.personId);
  const specialization = useGameSelector((state) => state.staff.employees[id]?.specialization);
  const seniority = useGameSelector((state) => state.staff.employees[id]?.seniority);
  const energy = useGameSelector((state) => {
    const current = state.staff.employees[id];
    return current ? Math.round(current.energy / ENERGY_SCALE) : 0;
  });
  const activity = useGameSelector((state) => {
    const current = state.staff.employees[id];
    if (!current) return null;
    const working = isWorking(state, current, config) || isTesting(state, current, config);
    return activityOf(state, current, working);
  });
  if (!personId || !specialization || !seniority || !activity) return null;

  return (
    <section className="selection-strip" aria-label={name}>
      <div className="strip-main">
        <Avatar person={{ personId, name, specialization }} size={36} />
        <div className="strip-who">
          <h3>{name}</h3>
          <p>{roleLabel({ specialization, seniority })}</p>
        </div>
        <div className="strip-state">
          <span className="strip-activity">{ACTIVITY_LABELS[activity]}</span>
          <span className="strip-energy" aria-label={`Energia ${energy}%`}>
            <Zap size={12} aria-hidden="true" />
            <span className="bar amber">
              <span style={{ width: `${energy}%` }} />
            </span>
            <b>{energy}%</b>
          </span>
        </div>
        <button type="button" className="primary-button strip-card" onClick={onExpand}>
          Karta ▸
        </button>
        <button type="button" className="strip-close" onClick={clear} aria-label="Odznacz">
          ✕
        </button>
      </div>
      <OrderRejectionLine id={id} />
    </section>
  );
}

// Odmowa rozkazu z dotknięcia sceny — na pasku i w pełnej karcie pracownika.
export function OrderRejectionLine({ id }: { id: EmployeeId }) {
  const rejection = useOrderRejection(id);
  const phase = useGameSelector((state) => state.mission.phase);
  if (!rejection) return null;
  return (
    <p className="strip-rejection warning" role="status">
      {orderRejectionMessage(rejection, phase)}
    </p>
  );
}

// Odmowa ostatniego rozkazu tej osoby — tylko z rozkazu wydanego po pokazaniu paska lub karty;
// znika po ORDER_REJECTION_MS albo przy kolejnym rozkazie (nowy `seq`).
function useOrderRejection(id: EmployeeId) {
  const feedback = useOrderFeedback();
  const [selectedAtSeq] = useState(() => feedback?.seq ?? 0);
  const [expiredSeq, setExpiredSeq] = useState(0);
  const rejection = visibleRejection(feedback, id, selectedAtSeq, expiredSeq);
  const seq = feedback?.seq ?? 0;
  useEffect(() => {
    if (!rejection) return;
    const timer = setTimeout(() => setExpiredSeq(seq), ORDER_REJECTION_MS);
    return () => clearTimeout(timer);
  }, [rejection, seq]);
  return rejection;
}
