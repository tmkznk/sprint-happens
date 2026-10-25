import { Briefcase, Users } from 'lucide-react';
import { useState } from 'react';
import { useBalanceConfig, useDispatch, useGameSelector } from '../../application/engineHooks';
import {
  TECH_SPECIALIZATIONS,
  type ContractTerms,
  type Offer,
  type ProjectId,
  type ReadonlyProject,
} from '../../domain/contracts';
import type { Employee } from '../../domain/employees';
import { missingRoles } from '../../simulation/assignments';
import { isReadyForDelivery, paymentPreview } from '../../simulation/delivery';
import { detectedBugCount, testCoverage } from '../../simulation/qa';
import { ConfirmDialog } from '../ConfirmDialog';
import { EmptyState } from '../EmptyState';
import { useNavigation } from '../navigation';
import { ModalLayer } from '../ModalLayer';
import { designPercent, pmBonusPermille, progressPercent } from '../../simulation/work';
import { money, SCOPE_LABELS, SPECIALIZATION_LABELS } from '../labels';
import { REJECTION_MESSAGES } from '../rejectionMessages';

type ProjectsTab = 'active' | 'offers' | 'archive';

// Zakładka „Projekty” (SH-033, wzór SH2): W toku / Zlecenia / Archiwum.
// CON-02 (Z): oferta pokazuje nazwę i opis, zakresy specjalizacji, termin, wynagrodzenie,
// zaliczkę, znaczenie designu i karę za opóźnienie. CON-03: przyjęcie bez kompletnego zespołu.
export function ProjectsView() {
  const offers = useGameSelector((state) => state.contracts.offers);
  const projects = useGameSelector((state) => state.contracts.projects);
  const phase = useGameSelector((state) => state.mission.phase);
  const active = Object.values(projects).filter((project) => project.status === 'active');
  const delivered = Object.values(projects).filter((project) => project.status === 'delivered');
  const [tab, setTab] = useState<ProjectsTab>(active.length > 0 ? 'active' : 'offers');
  const [message, setMessage] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<ProjectId | null>(null);
  const reportProject = reportFor ? projects[reportFor] : undefined;

  const tabs: { id: ProjectsTab; label: string; count: number }[] = [
    { id: 'active', label: 'W toku', count: active.length },
    { id: 'offers', label: 'Zlecenia', count: offers.length },
    { id: 'archive', label: 'Archiwum', count: delivered.length },
  ];

  return (
    <>
      <div className="segmented" role="tablist" aria-label="Projekty">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label} <span className="count">{item.count}</span>
          </button>
        ))}
      </div>
      {phase === 'workEnded' && (
        <p className="alert">
          Dzień pracy się skończył — przed rozliczeniem możesz jeszcze oddać gotowe projekty.
        </p>
      )}
      {message && (
        <p role="status" className="alert">
          {message}
        </p>
      )}
      {tab === 'active' && (
        <ActiveProjects
          projects={active}
          onDelivered={setReportFor}
          onBrowseOffers={() => setTab('offers')}
        />
      )}
      {tab === 'offers' && <Offers offers={offers} onMessage={setMessage} />}
      {tab === 'archive' && <Archive projects={delivered} onReport={setReportFor} />}
      {reportProject?.delivery && (
        <DeliveryReportDialog project={reportProject} onClose={() => setReportFor(null)} />
      )}
    </>
  );
}

function Offers({
  offers,
  onMessage,
}: {
  offers: readonly Offer[];
  onMessage: (message: string | null) => void;
}) {
  const day = useGameSelector((state) => state.mission.day);
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  const dispatch = useDispatch();
  const accept = (offer: Offer) => {
    const result = dispatch({ type: 'AcceptOffer', offerId: offer.id });
    onMessage(
      result.ok
        ? `Przyjęto: ${offer.name}. Zaliczka ${money.format(offer.advance)} jest już na koncie.`
        : REJECTION_MESSAGES[result.rejection.code],
    );
  };
  if (offers.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase size={40} />}
        title="Tablica jest pusta"
        text="Nowe oferty pojawią się następnego dnia."
      />
    );
  }
  return offers.map((offer) => (
    <article key={offer.id} className="contract-card">
      <h4>{offer.name}</h4>
      <p className="hint">{offer.description}</p>
      <Terms
        terms={offer}
        deadline={`${offer.deadlineDays} dni (do końca dnia ${day + offer.deadlineDays})`}
      />
      <button
        type="button"
        className="primary-button"
        disabled={!isWorking}
        onClick={() => accept(offer)}
      >
        Przyjmij
      </button>
    </article>
  ));
}

function ActiveProjects({
  projects,
  onDelivered,
  onBrowseOffers,
}: {
  projects: readonly ReadonlyProject[];
  onDelivered: (id: ProjectId) => void;
  onBrowseOffers: () => void;
}) {
  const employees = useGameSelector((state) => state.staff.employees);
  const day = useGameSelector((state) => state.mission.day);
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase size={40} />}
        title="Pierwszy kontrakt czeka"
        text="Wybierz projekt pasujący do swojego zespołu."
        action={{ label: 'Przeglądaj zlecenia', onClick: onBrowseOffers }}
      />
    );
  }
  return projects.map((project) => {
    const daysLeft = project.deadlineDay - day;
    const team = Object.values(employees).filter((e) => e.projectId === project.id);
    return (
      <article key={project.id} className="contract-card">
        <h4>{project.name}</h4>
        <p className="hint">
          Zespół:{' '}
          {team.length === 0
            ? 'nikt nie jest przypisany.'
            : team.map((e) => `${e.name} (${SPECIALIZATION_LABELS[e.specialization]})`).join(', ')}
        </p>
        <StaffingPrompt project={project} team={team} />
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
        <DeliverySection project={project} onDelivered={onDelivered} />
      </article>
    );
  });
}

function Archive({
  projects,
  onReport,
}: {
  projects: readonly ReadonlyProject[];
  onReport: (id: ProjectId) => void;
}) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase size={40} />}
        title="Archiwum jest puste"
        text="Tu trafią oddane projekty razem z raportem jakości."
      />
    );
  }
  return projects.map((project) => (
    <article key={project.id} className="contract-card">
      <h4>{project.name}</h4>
      <p className="hint">
        Oddany w dniu {project.delivery?.day} · wypłata{' '}
        {money.format(project.delivery?.payment ?? 0)} · reputacja{' '}
        {signed(project.delivery?.reputation.total ?? 0)}
      </p>
      <button type="button" className="secondary-button" onClick={() => onReport(project.id)}>
        Raport
      </button>
    </article>
  ));
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
      <button
        type="button"
        className="primary-button"
        disabled={!ready || !canDeliverNow}
        onClick={() => setConfirming(true)}
      >
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
    <ModalLayer>
      <div className="modal-backdrop">
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
    </ModalLayer>
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

// PROJ-02, PROJ-03: brak obsady stanowisk technicznych z pracą do zrobienia — skrót do zakładki
// Zespół, gdzie przydziela się ludzi (QA, Designer i PM są opcjonalni).
function StaffingPrompt({
  project,
  team,
}: {
  project: ReadonlyProject;
  team: readonly Pick<Employee, 'specialization'>[];
}) {
  const { open } = useNavigation();
  const missing = missingRoles(project, team);
  if (missing.length === 0) return null;
  return (
    <div className="staffing-prompt">
      <p className="warning">
        Brakuje: {missing.map((specialization) => SCOPE_LABELS[specialization]).join(', ')}
      </p>
      <button type="button" className="secondary-button" onClick={() => open('team')}>
        <Users size={16} aria-hidden="true" />
        Przydziel zespół
      </button>
    </div>
  );
}
