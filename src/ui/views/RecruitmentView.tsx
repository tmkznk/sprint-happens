import { useState } from 'react';
import { useDispatch, useGameSelector } from '../../application/engineHooks';
import {
  SENIORITIES,
  SPECIALIZATIONS,
  type Candidate,
  type Specialization,
} from '../../domain/employees';
import { personById } from '../../domain/content/people';
import { PROLOGUE_HELPER_BIO, PROLOGUE_HELPER_ID } from '../../domain/content/prologue';
import { isInDebt } from '../../simulation/finance';
import { freeDeskCount } from '../../simulation/staff';
import { Avatar } from '../Avatar';
import {
  money,
  SENIORITY_LABELS,
  SPECIALIZATION_LABELS,
  SPECIALIZATION_SHORT_LABELS,
} from '../labels';
import { LOCKS, RECRUIT_STORY } from '../prologue/copy';
import { spotlight, useGuide } from '../prologue/hooks';
import { REJECTION_MESSAGES } from '../rejectionMessages';

// EMP-03, EMP-04, FIN-03 (Z): wybór konkretnej osoby po zapoznaniu się z seniority i pensją;
// informacja o braku biurka i o należnej dniówce jest widoczna przed zatrudnieniem.
// Kafelek: awatar (na razie zastępczy), stanowisko i poziom; filtr stanowisk nad listą.
export function RecruitmentView() {
  const candidates = useGameSelector((state) => state.staff.candidates);
  const freeDesks = useGameSelector(freeDeskCount);
  const inDebt = useGameSelector(isInDebt);
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  // Prolog: jeden kandydat, opis fabularny etapu i bez filtrów.
  const prologue = useGameSelector((state) => state.prologue !== null);
  const hireGuided = useGuide()?.kind === 'hire';
  const dispatch = useDispatch();
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Specialization | 'all'>('all');
  // Kolejność: stanowisko (jak w filtrach), potem poziom.
  const visible = candidates
    .filter((c) => filter === 'all' || c.specialization === filter)
    .toSorted(
      (a, b) =>
        SPECIALIZATIONS.indexOf(a.specialization) - SPECIALIZATIONS.indexOf(b.specialization) ||
        SENIORITIES.indexOf(a.seniority) - SENIORITIES.indexOf(b.seniority),
    );

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
    <>
      <p className={freeDesks === 0 ? 'warning' : undefined}>
        {freeDesks === 0
          ? 'Brak wolnego biurka — nowa osoba będzie pobierać pensję, ale nie będzie mogła pracować.'
          : `Wolne biurka: ${freeDesks}.`}
      </p>
      <p className="hint">Dniówka jest należna już za dzisiejszy dzień, także przy zwolnieniu.</p>
      {blockedReason && <p className="alert">{blockedReason}</p>}
      {message && (
        <p role="status" className="alert">
          {message}
        </p>
      )}
      {prologue && <p className="hint">{hireGuided ? RECRUIT_STORY : LOCKS.rest}</p>}
      {!prologue && (
        <div className="filter-pills" role="group" aria-label="Filtruj według stanowiska">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            Wszyscy
          </button>
          {SPECIALIZATIONS.map((specialization) => (
            <button
              key={specialization}
              type="button"
              aria-pressed={filter === specialization}
              onClick={() => setFilter(specialization)}
            >
              {SPECIALIZATION_SHORT_LABELS[specialization]}
            </button>
          ))}
        </div>
      )}
      <ul className="candidate-list">
        {visible.map((candidate) => (
          <li key={candidate.id}>
            <Avatar person={candidate} />
            <div className="candidate-info">
              <span className="candidate-name">{candidate.name}</span>
              <span className="candidate-role">
                {SPECIALIZATION_LABELS[candidate.specialization]} ·{' '}
                {SENIORITY_LABELS[candidate.seniority]}
              </span>
              <span className="candidate-wage">{money.format(candidate.dailyWage)} zł / dzień</span>
            </div>
            <button
              type="button"
              className={spotlight('primary-button', hireGuided)}
              disabled={blockedReason !== null}
              onClick={() => hire(candidate)}
              aria-label={`Zatrudnij: ${candidate.name}, ${SENIORITY_LABELS[candidate.seniority]}`}
            >
              Zatrudnij
            </button>
            <p className="bio">
              {prologue && candidate.personId === PROLOGUE_HELPER_ID
                ? PROLOGUE_HELPER_BIO
                : personById(candidate.personId)?.bio}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
