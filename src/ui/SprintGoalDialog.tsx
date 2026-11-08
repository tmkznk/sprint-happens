import { useState } from 'react';
import { useDispatch, useGameSelector } from '../application/engineHooks';
import type { ProjectId } from '../domain/contracts';
import { ModalLayer } from './ModalLayer';
import { REJECTION_MESSAGES } from './rejectionMessages';

// SH-054, SH-058: planowanie sprintu — wybór celu (jeden aktywny projekt albo „bez celu”).
// Gra stoi do wyboru; po nim rusza w tempie 1×. Selektory zwracają teksty.
export function SprintGoalDialog() {
  const dispatch = useDispatch();
  const open = useGameSelector(
    (state) => state.scrum?.pendingGoal === true && state.mission.phase === 'working',
  );
  const sprint = useGameSelector((state) => state.scrum?.sprint?.number ?? 0);
  const projects = useGameSelector((state) =>
    Object.values(state.contracts.projects)
      .filter((p) => p.status === 'active')
      .map((p) => `${p.id}\t${p.name}`)
      .join('\n'),
  );
  const [message, setMessage] = useState<string | null>(null);
  if (!open) return null;

  const choose = (projectId: ProjectId | null) => {
    const result = dispatch({ type: 'ChooseSprintGoal', projectId });
    if (!result.ok) {
      setMessage(REJECTION_MESSAGES[result.rejection.code]);
      return;
    }
    setMessage(null);
    dispatch({ type: 'SetSpeed', speed: 1 });
  };
  const list = projects
    ? projects.split('\n').map((line) => {
        const [id = '', name = ''] = line.split('\t');
        return { id: id as ProjectId, name };
      })
    : [];

  return (
    <ModalLayer>
      <div className="modal-backdrop">
        <section
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sprint-goal-title"
        >
          <p className="kicker">Planowanie · sprint {sprint}</p>
          <h2 id="sprint-goal-title">Cel sprintu</h2>
          <p>
            Wybierz projekt, na którym zespół skupi się przez cały sprint — praca nad nim pójdzie
            szybciej. Oddany przed końcem sprintu: reputacja i zadowolenie w górę. Nieoddany: mały
            minus.
          </p>
          <div className="event-options">
            {list.map((project) => (
              <button
                key={project.id}
                type="button"
                className="event-option"
                onClick={() => choose(project.id)}
              >
                <strong>{project.name}</strong>
              </button>
            ))}
            <button type="button" className="event-option" onClick={() => choose(null)}>
              <strong>Bez celu</strong>
              <span>Spokojny sprint — bez premii i bez ryzyka.</span>
            </button>
          </div>
          {message && <p className="warning">{message}</p>}
        </section>
      </div>
    </ModalLayer>
  );
}
