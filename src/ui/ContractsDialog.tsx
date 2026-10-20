import { useState } from 'react';
import { useDispatch, useGameSelector } from '../application/engineHooks';
import { TECH_SPECIALIZATIONS, type ContractTerms, type Offer } from '../domain/contracts';
import { progressPercent } from '../simulation/work';
import { money, SPECIALIZATION_LABELS } from './labels';
import { REJECTION_MESSAGES } from './rejectionMessages';

const SCOPE_LABELS = {
  frontend: 'Frontend',
  backend: 'Backend',
  mobile: 'Mobile',
  devops: 'DevOps',
};

// CON-02 (Z): oferta pokazuje nazwę i opis, zakresy specjalizacji, termin, wynagrodzenie,
// zaliczkę, znaczenie designu i karę za opóźnienie. CON-03: przyjęcie bez kompletnego zespołu.
export function ContractsDialog({ onClose }: { onClose(): void }) {
  const offers = useGameSelector((state) => state.contracts.offers);
  const projects = useGameSelector((state) => state.contracts.projects);
  const employees = useGameSelector((state) => state.staff.employees);
  const day = useGameSelector((state) => state.mission.day);
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  const dispatch = useDispatch();
  const [message, setMessage] = useState<string | null>(null);

  const accept = (offer: Offer) => {
    const result = dispatch({ type: 'AcceptOffer', offerId: offer.id });
    setMessage(
      result.ok
        ? `Przyjęto: ${offer.name}. Zaliczka ${money.format(offer.advance)} jest już na koncie.`
        : REJECTION_MESSAGES[result.rejection.code],
    );
  };
  const active = Object.values(projects).filter((project) => project.status === 'active');

  return (
    <div className="modal-backdrop fullscreen">
      <section
        className="modal contracts"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contracts-title"
      >
        <header className="modal-header">
          <h2 id="contracts-title">Zlecenia</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zamknij">
            ✕
          </button>
        </header>
        {!isWorking && <p className="warning">{REJECTION_MESSAGES.phaseNotAllowed}</p>}
        {message && (
          <p role="status" className="hint">
            {message}
          </p>
        )}

        <h3>Oferty</h3>
        {offers.length === 0 && <p className="hint">Nowe oferty pojawią się następnego dnia.</p>}
        {offers.map((offer) => (
          <article key={offer.id} className="contract-card">
            <h4>{offer.name}</h4>
            <p className="hint">{offer.description}</p>
            <Terms
              terms={offer}
              deadline={`${offer.deadlineDays} dni (do końca dnia ${day + offer.deadlineDays})`}
            />
            <button type="button" disabled={!isWorking} onClick={() => accept(offer)}>
              Przyjmij
            </button>
          </article>
        ))}

        <h3>Projekty w toku</h3>
        {active.length === 0 && <p className="hint">Brak przyjętych kontraktów.</p>}
        {active.map((project) => {
          const daysLeft = project.deadlineDay - day;
          const team = Object.values(employees).filter((e) => e.projectId === project.id);
          return (
            <article key={project.id} className="contract-card">
              <h4>{project.name}</h4>
              <p className="hint">
                Zespół:{' '}
                {team.length === 0
                  ? 'nikt nie jest przypisany — przydziel pracowników w ich panelu.'
                  : team
                      .map((e) => `${e.name} (${SPECIALIZATION_LABELS[e.specialization]})`)
                      .join(', ')}
              </p>
              <ul className="progress-list" aria-label="Postęp prac">
                {TECH_SPECIALIZATIONS.filter((s) => project.scopes[s] !== undefined).map((s) => (
                  <li key={s}>
                    <span>{SCOPE_LABELS[s]}</span>
                    <progress max={100} value={progressPercent(project, s)} />
                    <span>{progressPercent(project, s)}%</span>
                  </li>
                ))}
              </ul>
              <Terms
                terms={project}
                deadline={
                  daysLeft >= 0
                    ? `koniec dnia ${project.deadlineDay} (zostało dni: ${daysLeft})`
                    : `minął w dniu ${project.deadlineDay}`
                }
              />
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Terms({ terms, deadline }: { terms: ContractTerms; deadline: string }) {
  const scopes = TECH_SPECIALIZATIONS.filter((s) => terms.scopes[s] !== undefined)
    .map((s) => `${SCOPE_LABELS[s]} ${terms.scopes[s]} pp`)
    .join(' · ');
  return (
    <dl className="contract-terms">
      <dt>Zakres</dt>
      <dd>{scopes}</dd>
      <dt>Design</dt>
      <dd>
        {terms.designImportance === 0
          ? 'bez znaczenia'
          : `${'★'.repeat(terms.designImportance)}${'☆'.repeat(5 - terms.designImportance)}`}
      </dd>
      <dt>Termin</dt>
      <dd>{deadline}</dd>
      <dt>Wynagrodzenie</dt>
      <dd>{money.format(terms.reward)}</dd>
      <dt>Zaliczka</dt>
      <dd>{money.format(terms.advance)}</dd>
      <dt>Kara za dzień opóźnienia</dt>
      <dd>{money.format(terms.latePenaltyPerDay)}</dd>
    </dl>
  );
}
