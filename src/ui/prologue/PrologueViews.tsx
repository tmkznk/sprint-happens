import { ArrowUpRight, Check, Coffee, Flag, X } from 'lucide-react';
import { useState } from 'react';
import { useSelection } from '../../application/selectionHooks';
import { useFurnitureEdit } from '../../application/furnitureEditHooks';
import { completedGoals, type PrologueStep } from '../../domain/prologue';
import { ConfirmDialog } from '../ConfirmDialog';
import { ModalLayer } from '../ModalLayer';
import { useNavigation } from '../navigation';
import { FINALE, GOALS, STEP_COPY } from './copy';
import { usePrologueStep } from './hooks';

// Komunikat etapu prologu w formie karty „Kawa jest. Brakuje tylko zespołu.”: pokazuje się sam
// na początku etapu; po zamknięciu bieżące zadanie jest dostępne w „Cel misji”.
export function PrologueCard() {
  const step = usePrologueStep();
  const selection = useSelection();
  const editing = useFurnitureEdit() !== null;
  const [closed, setClosed] = useState<PrologueStep | null>(null);
  if (!step || step === 'finished' || selection || editing) return null;
  const copy = STEP_COPY[step];
  if (!copy.announce || closed === step) return null;

  return (
    <aside className="intro-card prologue-card" aria-label="Prolog">
      <span className="intro-icon">
        <Coffee size={22} />
      </span>
      <div>
        <StepContent step={step} onAction={() => setClosed(step)} />
      </div>
      <button
        type="button"
        className="icon-button prologue-close"
        aria-label="Zamknij komunikat"
        onClick={() => setClosed(step)}
      >
        <X size={16} />
      </button>
    </aside>
  );
}

// Tytuł, tekst fabularny, zadanie i przycisk do panelu, w którym gracz sam wykonuje czynność.
function StepContent({
  step,
  onAction,
}: {
  step: Exclude<PrologueStep, 'finished'>;
  onAction?(): void;
}) {
  const { open } = useNavigation();
  const copy = STEP_COPY[step];
  return (
    <>
      <h2>{copy.title}</h2>
      {copy.story.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <p className="prologue-task">
        <Flag size={14} aria-hidden="true" /> {copy.task}
      </p>
      <div className="intro-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            onAction?.();
            open(copy.action.tab);
          }}
        >
          {copy.action.label} <ArrowUpRight size={16} />
        </button>
      </div>
    </>
  );
}

// Pięć celów prologu z zaznaczeniem zaliczonych.
export function PrologueGoals() {
  const step = usePrologueStep();
  if (!step) return null;
  const done = completedGoals(step);
  return (
    <ol className="prologue-goals" aria-label="Cele prologu">
      {GOALS.map((goal, index) => (
        <li key={goal} className={index < done ? 'done' : index === done ? 'current' : undefined}>
          <span className="prologue-goal-mark" aria-hidden="true">
            {index < done ? <Check size={12} /> : index + 1}
          </span>
          <span>
            {goal}
            {index < done && <span className="visually-hidden"> (zaliczone)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

// „Cel misji” w prologu: bieżący krok (także po zamknięciu komunikatu), cele i pominięcie.
export function PrologueGoalsView({ onSkip }: { onSkip(): void }) {
  const step = usePrologueStep();
  const [asking, setAsking] = useState(false);
  if (!step) return null;
  return (
    <>
      {step !== 'finished' && (
        <section className="card prologue-step">
          <p className="kicker">Prolog · JanuszSoft</p>
          <StepContent step={step} />
        </section>
      )}
      <section className="card">
        <PrologueGoals />
      </section>
      <p className="hint">
        Prolog uczy podstaw na zasadach właściwej gry. Po jego ukończeniu zaczniesz pełną misję.
      </p>
      <button type="button" className="secondary-button" onClick={() => setAsking(true)}>
        Pomiń prolog
      </button>
      {asking && (
        <ConfirmDialog
          title="Pominąć prolog?"
          message="Zaczniesz właściwą misję od początku. Postęp prologu nie zostanie zachowany."
          confirmLabel="Pomiń prolog"
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            onSkip();
          }}
        />
      )}
    </>
  );
}

// Komunikat końcowy: podsumowanie celów i przejście do właściwej rozgrywki.
export function PrologueFinale({ onFinish }: { onFinish(): void }) {
  const step = usePrologueStep();
  if (step !== 'finished') return null;
  return (
    <ModalLayer>
      <div className="modal-backdrop">
        <section
          className="modal prologue-finale"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prologue-finale-title"
        >
          <p className="kicker">Prolog ukończony</p>
          <h2 id="prologue-finale-title">{FINALE.title}</h2>
          {FINALE.story.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <ul className="prologue-goals" aria-label="Podsumowanie celów">
            {FINALE.summary.map((line) => (
              <li key={line} className="done">
                <span className="prologue-goal-mark" aria-hidden="true">
                  <Check size={12} />
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="modal-actions">
            <button type="button" onClick={onFinish}>
              {FINALE.button}
            </button>
          </div>
        </section>
      </div>
    </ModalLayer>
  );
}
