import { useState } from 'react';
import { useDispatch, useGameSelector } from '../application/engineHooks';
import { SPECIALIZATIONS, type Candidate } from '../domain/employees';
import { isInDebt } from '../simulation/finance';
import { freeDeskCount } from '../simulation/staff';
import { money, SENIORITY_LABELS, SPECIALIZATION_LABELS } from './labels';
import { REJECTION_MESSAGES } from './rejectionMessages';

// EMP-03, EMP-04, FIN-03 (Z): wybór konkretnej osoby po zapoznaniu się z seniority i pensją;
// informacja o braku biurka i o należnej dniówce jest widoczna przed zatrudnieniem.
export function RecruitmentDialog({ onClose }: { onClose(): void }) {
  const candidates = useGameSelector((state) => state.staff.candidates);
  const freeDesks = useGameSelector(freeDeskCount);
  const inDebt = useGameSelector(isInDebt);
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  const dispatch = useDispatch();
  const [message, setMessage] = useState<string | null>(null);

  const blockedReason = !isWorking
    ? REJECTION_MESSAGES.phaseNotAllowed
    : inDebt
      ? REJECTION_MESSAGES.inDebt
      : null;

  function hire(candidate: Candidate) {
    const result = dispatch({ type: 'HireCandidate', candidateId: candidate.id });
    setMessage(
      result.ok ? `Zatrudniono: ${candidate.name}.` : REJECTION_MESSAGES[result.rejection.code],
    );
  }

  return (
    <div className="modal-backdrop fullscreen">
      <section
        className="modal recruitment"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recruitment-title"
      >
        <header className="modal-header">
          <h2 id="recruitment-title">Rekrutacja</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zamknij">
            ✕
          </button>
        </header>
        <p className={freeDesks === 0 ? 'warning' : undefined}>
          {freeDesks === 0
            ? 'Brak wolnego biurka — nowa osoba będzie pobierać pensję, ale nie będzie mogła pracować.'
            : `Wolne biurka: ${freeDesks}.`}
        </p>
        <p className="hint">Dniówka jest należna już za dzisiejszy dzień, także przy zwolnieniu.</p>
        {blockedReason && <p className="warning">{blockedReason}</p>}
        {message && (
          <p role="status" className="hint">
            {message}
          </p>
        )}
        <div className="candidate-list">
          {SPECIALIZATIONS.map((specialization) => (
            <section key={specialization}>
              <h3>{SPECIALIZATION_LABELS[specialization]}</h3>
              <ul>
                {candidates
                  .filter((c) => c.specialization === specialization)
                  .map((candidate) => (
                    <li key={candidate.id}>
                      <span className="candidate-name">{candidate.name}</span>
                      <span>{SENIORITY_LABELS[candidate.seniority]}</span>
                      <span>{money.format(candidate.dailyWage)} / dzień</span>
                      <button
                        type="button"
                        disabled={blockedReason !== null}
                        onClick={() => hire(candidate)}
                        aria-label={`Zatrudnij: ${candidate.name}, ${SENIORITY_LABELS[candidate.seniority]}`}
                      >
                        Zatrudnij
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
