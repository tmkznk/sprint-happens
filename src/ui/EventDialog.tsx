import { useState } from 'react';
import { useBalanceConfig, useDispatch, useGameSelector } from '../application/engineHooks';
import { eventTemplate } from '../simulation/events';
import { describeOption } from './eventLabels';
import { REJECTION_MESSAGES } from './rejectionMessages';

// EVT-01, EVT-02: zdarzenie decyzyjne — gra stoi do wyboru; okno przechwytuje dotyk (T:VIEW-03).
export function EventDialog() {
  const config = useBalanceConfig();
  const dispatch = useDispatch();
  const pending = useGameSelector((state) => state.events.pending);
  const project = useGameSelector((state) =>
    pending?.projectId ? state.contracts.projects[pending.projectId] : undefined,
  );
  const [message, setMessage] = useState<string | null>(null);
  const template = pending ? eventTemplate(pending.templateId) : undefined;
  if (!pending || !template) return null;

  const choose = (optionId: string) => {
    const result = dispatch({ type: 'ResolveEvent', optionId });
    setMessage(result.ok ? null : REJECTION_MESSAGES[result.rejection.code]);
  };

  return (
    <div className="modal-backdrop fullscreen">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="event-title">
        <h2 id="event-title">{template.title}</h2>
        <p>{template.description}</p>
        {project && <p className="hint">Dotyczy projektu: {project.name}</p>}
        <div className="event-options">
          {template.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="event-option"
              onClick={() => choose(option.id)}
            >
              <strong>{option.label}</strong>
              <span>{describeOption(option, project, config).join(' · ')}</span>
            </button>
          ))}
        </div>
        <p className="hint">Gra jest wstrzymana do wyboru. Potem wróci do poprzedniego tempa.</p>
        {message && <p className="warning">{message}</p>}
      </section>
    </div>
  );
}
