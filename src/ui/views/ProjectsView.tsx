import { ArrowUpRight, Briefcase, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { CONTRACT_TEMPLATES } from '../../domain/content/contracts';
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
import { Avatar } from '../Avatar';
import { EmptyState } from '../EmptyState';
import { useNavigation } from '../navigation';
import { ModalLayer } from '../ModalLayer';
import { designPercent, pmBonusPermille, progressPercent } from '../../simulation/work';
import { money, SCOPE_LABELS } from '../labels';
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
    <article key={offer.id} className="project-card">
      <div className="card-top">
        <span className="eyebrow">Poziom {templateLevel(offer.templateId)}</span>
        <span className="pill">
          {offer.deadlineDays} {offer.deadlineDays === 1 ? 'dzień' : 'dni'} · do dnia{' '}
          {day + offer.deadlineDays}
        </span>
      </div>
      <h3>{offer.name}</h3>
      <p className="card-description">{offer.description}</p>
      <ScopeChips terms={offer} />
      <div className="offer-numbers">
        <div>
          <small>Wynagrodzenie</small>
          <strong>{money.format(offer.reward)} zł</strong>
        </div>
        <div>
          <small>Zaliczka od razu</small>
          <strong>{money.format(offer.advance)} zł</strong>
        </div>
      </div>
      <p className="fineprint">
        Kara {money.format(offer.latePenaltyPerDay)} zł za każdy rozpoczęty dzień spóźnienia, do
        wysokości reszty wypłaty.{' '}
        {offer.designScope > 0
          ? `Opcjonalny design: ${offer.designScope} pp, do +${offer.designImportance} reputacji.`
          : 'Bez designu.'}
      </p>
      <button
        type="button"
        className="primary-button full"
        disabled={!isWorking}
        onClick={() => accept(offer)}
      >
        Przyjmij zlecenie <ArrowUpRight size={16} aria-hidden="true" />
      </button>
    </article>
  ));
}

// Poziom trudności szablonu (SH-032 A3b) — etykieta nad tytułem karty.
function templateLevel(templateId: string): number {
  return CONTRACT_TEMPLATES.find((template) => template.id === templateId)?.level ?? 1;
}

// CON-02: zakresy specjalizacji jako pastylki.
function ScopeChips({ terms }: { terms: ContractTerms }) {
  return (
    <div className="chips">
      {TECH_SPECIALIZATIONS.filter((s) => terms.scopes[s] !== undefined).map((s) => (
        <span key={s} className="pill">
          {SCOPE_LABELS[s]} · {terms.scopes[s]} pp
        </span>
      ))}
    </div>
  );
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
    const late = day > project.deadlineDay;
    const team = Object.values(employees).filter((e) => e.projectId === project.id);
    return (
      <article key={project.id} className="project-card">
        <div className="card-top">
          <span className="eyebrow">Poziom {templateLevel(project.templateId)}</span>
          <span className={late ? 'pill danger' : 'pill'}>
            {late
              ? `Termin minął: dzień ${project.deadlineDay}`
              : `Termin: dzień ${project.deadlineDay}`}
          </span>
        </div>
        <h3>{project.name}</h3>
        <p className="card-description">{project.description}</p>
        {TECH_SPECIALIZATIONS.filter((s) => project.scopes[s] !== undefined).map((s) => (
          <div key={s} className="scope">
            <div>
              <span>{SCOPE_LABELS[s]}</span>
              <strong>{progressPercent(project, s)}%</strong>
            </div>
            <span className="bar">
              <span style={{ width: `${progressPercent(project, s)}%` }} />
            </span>
          </div>
        ))}
        <ProjectStats project={project} />
        <DeliveryFooter project={project} onDelivered={onDelivered} />
        <AssignedRow project={project} team={team} />
      </article>
    );
  });
}

// BUG-03, PROJ-10, PROJ-11: testy, wykryte błędy (jedyna liczba błędów widoczna przed oddaniem),
// design i premia PM-a; bez testów — „Jakość niezweryfikowana”.
function ProjectStats({ project }: { project: ReadonlyProject }) {
  const config = useBalanceConfig();
  const bonus = useGameSelector((state) => pmBonusPermille(state, project.id, config));
  const coverage = testCoverage(project, config);
  return (
    <>
      <div className="project-stats">
        <span>
          Testy <b>{coverage === null ? '—' : `${coverage}%`}</b>
        </span>
        <span>
          Wykryte błędy <b>{detectedBugCount(project, config)}</b>
        </span>
        {project.designScope > 0 && (
          <span>
            Design <b>{designPercent(project)}%</b>
          </span>
        )}
        {bonus > 0 && (
          <span>
            Premia PM <b>+{bonus / 10}%</b>
          </span>
        )}
      </div>
      {(coverage === null || coverage === 0) && (
        <small className="card-note">Jakość niezweryfikowana.</small>
      )}
    </>
  );
}

// PROJ-02, PROJ-03: zespół projektu (awatary) i skrót do zakładki Zespół, gdy brakuje obsady
// stanowisk technicznych z pracą do zrobienia (QA, Designer i PM są opcjonalni).
function AssignedRow({
  project,
  team,
}: {
  project: ReadonlyProject;
  team: readonly Pick<Employee, 'id' | 'name' | 'specialization'>[];
}) {
  const { open } = useNavigation();
  const missing = missingRoles(project, team);
  return (
    <div className="assigned">
      {team.length > 0 && (
        <span
          className="assigned-avatars"
          aria-label={`Zespół: ${team.map((e) => e.name).join(', ')}`}
        >
          {team.map((member) => (
            <Avatar
              key={member.id}
              name={member.name}
              specialization={member.specialization}
              size={26}
            />
          ))}
        </span>
      )}
      {missing.length > 0 ? (
        <>
          <span className="assigned-missing">
            Brakuje: {missing.map((specialization) => SCOPE_LABELS[specialization]).join(', ')}
          </span>
          <button type="button" className="assign-button" onClick={() => open('team')}>
            <UserPlus size={15} aria-hidden="true" />
            Przydziel zespół
          </button>
        </>
      ) : (
        team.length === 0 && <span className="assigned-missing">Nikt nie jest przypisany.</span>
      )}
    </div>
  );
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
    <article key={project.id} className="project-card">
      <div className="card-top">
        <span className="eyebrow">Oddany w dniu {project.delivery?.day}</span>
        <span className="pill">Reputacja {signed(project.delivery?.reputation.total ?? 0)}</span>
      </div>
      <h3>{project.name}</h3>
      <div className="offer-numbers">
        <div>
          <small>Wypłata przy oddaniu</small>
          <strong>{money.format(project.delivery?.payment ?? 0)} zł</strong>
        </div>
        <div>
          <small>Jakość techniczna</small>
          <strong>{percent(project.delivery?.qualityPermille ?? 0)}</strong>
        </div>
      </div>
      <button type="button" className="secondary-button full" onClick={() => onReport(project.id)}>
        Raport
      </button>
    </article>
  ));
}

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0');
const percent = (permille: number) => `${Math.floor(permille / 10)}%`;

// PROJ-06, FIN-04 (Z): oddanie ręcznie, po ukończeniu techniki; stopka pokazuje bieżącą
// wypłatę z potrąceniem. Podgląd nie ujawnia jakości — ukryte błędy dopiero w raporcie (BUG-03).
function DeliveryFooter({
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
        <p className="card-alert">
          Opóźnienie: {preview.daysLate} {preview.daysLate === 1 ? 'dzień' : 'dni'} · potrącenie{' '}
          {money.format(preview.penalty)} zł
        </p>
      )}
      {/* Decyzja z 2026-10-22: po funkcjach zespół sam naprawia wykryte błędy — gracz wybiera
          moment oddania: teraz z błędami albo później, ryzykując opóźnienie. */}
      <small className="card-note">
        {ready
          ? `Funkcje gotowe · oddanie dziś: ${preview.daysLate === 0 ? 'w terminie' : `opóźnienie ${preview.daysLate} dni`}${
              openBugs > 0 ? ` · zespół naprawia wykryte błędy (zostało: ${openBugs})` : ''
            }`
          : 'Oddanie po ukończeniu wszystkich części technicznych.'}
      </small>
      <div className="card-bottom">
        <span>
          Do wypłaty
          <strong>{money.format(preview.payment)} zł</strong>
        </span>
        <button
          type="button"
          className="primary-button"
          disabled={!ready || !canDeliverNow}
          onClick={() => setConfirming(true)}
        >
          Oddaj projekt <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>
      {message && <p className="warning">{message}</p>}
      {confirming && (
        <ConfirmDialog
          title={`Oddać „${project.name}”?`}
          message={`Wypłata ${money.format(preview.payment)} zł${
            preview.penalty > 0 ? ` (potrącenie ${money.format(preview.penalty)} zł)` : ''
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
