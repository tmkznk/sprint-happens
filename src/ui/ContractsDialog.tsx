import { useState } from 'react';
import { useBalanceConfig, useDispatch, useGameSelector } from '../application/engineHooks';
import {
  TECH_SPECIALIZATIONS,
  type ContractTerms,
  type Offer,
  type ProjectId,
  type ReadonlyProject,
} from '../domain/contracts';
import { isReadyForDelivery, paymentPreview } from '../simulation/delivery';
import { detectedBugCount, testCoverage } from '../simulation/qa';
import { ConfirmDialog } from './ConfirmDialog';
import { designPercent, pmBonusPermille, progressPercent } from '../simulation/work';
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
  const phase = useGameSelector((state) => state.mission.phase);
  const isWorking = phase === 'working';
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
  const delivered = Object.values(projects).filter((project) => project.status === 'delivered');
  const [reportFor, setReportFor] = useState<ProjectId | null>(null);
  const reportProject = reportFor ? projects[reportFor] : undefined;

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
        {phase === 'workEnded' && (
          <p className="warning">
            Dzień pracy się skończył — przed rozliczeniem możesz jeszcze oddać gotowe projekty.
          </p>
        )}
        {phase === 'settled' && <p className="warning">{REJECTION_MESSAGES.phaseNotAllowed}</p>}
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
                {/* PROJ-10: opcjonalny zakres designu — nie blokuje oddania. */}
                {project.designScope > 0 && (
                  <li>
                    <span>Design</span>
                    <progress max={100} value={designPercent(project)} />
                    <span>{designPercent(project)}%</span>
                  </li>
                )}
              </ul>
              <PmBonusLine project={project} />
              <QualityLine project={project} />
              <Terms
                terms={project}
                deadline={
                  daysLeft >= 0
                    ? `koniec dnia ${project.deadlineDay} (zostało dni: ${daysLeft})`
                    : `minął w dniu ${project.deadlineDay}`
                }
              />
              <DeliverySection project={project} onDelivered={setReportFor} />
            </article>
          );
        })}

        {delivered.length > 0 && <h3>Oddane projekty</h3>}
        {delivered.map((project) => (
          <article key={project.id} className="contract-card">
            <h4>{project.name}</h4>
            <p className="hint">
              Oddany w dniu {project.delivery?.day} · wypłata{' '}
              {money.format(project.delivery?.payment ?? 0)} · reputacja{' '}
              {signed(project.delivery?.reputation.total ?? 0)}
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setReportFor(project.id)}
            >
              Raport
            </button>
          </article>
        ))}
      </section>
      {reportProject?.delivery && (
        <DeliveryReportDialog project={reportProject} onClose={() => setReportFor(null)} />
      )}
    </div>
  );
}

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0');
const percent = (permille: number) => `${Math.floor(permille / 10)}%`;

// PROJ-06, FIN-04 (Z): oddanie ręcznie, po ukończeniu techniki; panel pokazuje bieżące potrącenie.
// Podgląd nie ujawnia jakości — ukryte błędy są widoczne dopiero w raporcie (BUG-03).
function DeliverySection({
  project,
  onDelivered,
}: {
  project: ReadonlyProject;
  onDelivered: (id: ProjectId) => void;
}) {
  const dispatch = useDispatch();
  const day = useGameSelector((state) => state.mission.day);
  const canDeliverNow = useGameSelector(
    (state) => state.mission.phase === 'working' || state.mission.phase === 'workEnded',
  );
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const config = useBalanceConfig();
  const preview = paymentPreview(project, day);
  const ready = isReadyForDelivery(project);
  const openBugs = detectedBugCount(project, config);

  const deliver = () => {
    setConfirming(false);
    const result = dispatch({ type: 'DeliverProject', projectId: project.id });
    if (result.ok) onDelivered(project.id);
    else setMessage(REJECTION_MESSAGES[result.rejection.code]);
  };

  return (
    <>
      {preview.daysLate > 0 && (
        <p className="warning">
          Opóźnienie: {preview.daysLate} dni · potrącenie {money.format(preview.penalty)}
        </p>
      )}
      <button type="button" disabled={!ready || !canDeliverNow} onClick={() => setConfirming(true)}>
        Oddaj projekt
      </button>
      {!ready && <p className="hint">Oddanie po ukończeniu wszystkich części technicznych.</p>}
      {/* Decyzja z 2026-10-22: po funkcjach zespół sam naprawia wykryte błędy — gracz wybiera
          moment oddania: teraz z błędami albo później, ryzykując opóźnienie. */}
      {ready && (
        <p className="hint">
          Funkcje gotowe · oddanie dziś:{' '}
          {preview.daysLate === 0 ? 'w terminie' : `opóźnienie ${preview.daysLate} dni`}
          {openBugs > 0 && ` · zespół naprawia wykryte błędy (zostało: ${openBugs})`}
        </p>
      )}
      {message && <p className="warning">{message}</p>}
      {confirming && (
        <ConfirmDialog
          title={`Oddać „${project.name}”?`}
          message={`Wypłata ${money.format(preview.payment)}${
            preview.penalty > 0 ? ` (potrącenie ${money.format(preview.penalty)})` : ''
          }. Nienaprawione błędy obniżą jakość i reputację, nie wypłatę. Projektu nie będzie można już rozwijać.`}
          confirmLabel="Oddaj"
          onConfirm={deliver}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

// PROJ-07, BUG-04, REP-04 (Z): raport rozdziela terminowość, jakość techniczną, design i pieniądze.
function DeliveryReportDialog({
  project,
  onClose,
}: {
  project: ReadonlyProject;
  onClose: () => void;
}) {
  const report = project.delivery;
  if (!report) return null;
  return (
    <div className="modal-backdrop fullscreen">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="delivery-title">
        <h2 id="delivery-title">Oddano: {project.name}</h2>
        <dl>
          <dt>Terminowość</dt>
          <dd>
            {report.daysLate === 0 ? 'w terminie' : `opóźnienie ${report.daysLate} dni`} (
            {signed(report.reputation.punctuality)})
          </dd>
          <dt>Jakość techniczna</dt>
          <dd>
            {percent(report.qualityPermille)} · pozostałe błędy: {report.remainingBugs} (
            {signed(report.reputation.quality)})
          </dd>
          <dt>Design</dt>
          <dd>
            {project.designScope === 0
              ? 'nie dotyczy'
              : `${percent(report.designPermille)} ukończenia`}{' '}
            ({signed(report.reputation.design)})
          </dd>
          <dt>Reputacja</dt>
          <dd>
            {signed(report.reputation.total)} → {report.reputationAfter}/100
          </dd>
          <dt>Wypłata</dt>
          <dd>
            +{money.format(report.payment)}
            {report.penalty > 0 && ` (kara −${money.format(report.penalty)})`}
          </dd>
        </dl>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Zamknij
          </button>
        </div>
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

// BUG-03 (Z): widoczne są tylko wykryte błędy i zakres testów, nigdy liczba ukrytych.
// Zero wykrytych błędów nie jest deklaracją bezbłędności (BUG-06: bez pracy — brak procentu).
function QualityLine({ project }: { project: ReadonlyProject }) {
  const config = useBalanceConfig();
  const coverage = testCoverage(project, config);
  if (coverage === null) return null;
  if (coverage === 0) return <p className="hint">Jakość niezweryfikowana</p>;
  return (
    <p className="hint">
      Przetestowano {coverage}% wykonanej pracy · wykryte błędy: {detectedBugCount(project, config)}
    </p>
  );
}

// PROJ-11 (Z): premia PM-a widoczna na karcie projektu.
function PmBonusLine({ project }: { project: ReadonlyProject }) {
  const config = useBalanceConfig();
  const bonus = useGameSelector((state) => pmBonusPermille(state, project.id, config));
  if (bonus === 0) return null;
  return <p className="hint">Premia PM-a: +{bonus / 10}% wydajności zespołu</p>;
}
