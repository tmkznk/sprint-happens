import { Building2, Coffee, Pause, Play, ArrowUpRight } from 'lucide-react';
import type { RefObject } from 'react';
import { useDispatch, useGameSelector } from '../application/engineHooks';
import type { SaveManager } from '../application/saveManager';
import { useFurnitureEdit } from '../application/furnitureEditHooks';
import { useSelection } from '../application/selectionHooks';
import type { GameState } from '../domain/state';
import type { Engine } from '../simulation/engine';
import { DayCard } from './DayCard';
import { useNavigation } from './navigation';
import { OfficeSceneBubble } from './OfficeSceneBubble';
import { SelectionPanel } from './SelectionPanel';
import { StaffAlerts } from './StaffAlerts';
import { UpdateBanner } from './UpdateBanner';

// Nagłówek biura zależny od sytuacji firmy (SH-033, wzór SH2).
function headline(state: GameState): string {
  if (state.mission.phase !== 'working') return 'Koniec dnia. Czas na rozliczenie';
  const hasTeam = Object.keys(state.staff.employees).length > 0;
  const hasProjects = Object.keys(state.contracts.projects).length > 0;
  if (!hasTeam && !hasProjects) return 'Tu zaczyna się wielki kod';
  if (!hasTeam) return 'Zlecenie jest. Brakuje ludzi';
  if (!hasProjects) return 'Zespół czeka na pierwszy projekt';
  return 'Sprint trwa';
}

// „Z życia biura”: ostatnie ważne wydarzenie wynikające ze stanu (bez osobnego dziennika).
function officeNews(state: GameState): string {
  const today = state.mission.day;
  const quit = state.staff.departures.filter((d) => d.day === today).at(-1);
  if (quit) {
    return quit.reason === 'quit'
      ? `${quit.name} odchodzi z firmy. Biurko zwolnione.`
      : `${quit.name} nie pracuje już w firmie.`;
  }
  const delivered = Object.values(state.contracts.projects)
    .filter((p) => p.delivery?.day === today)
    .at(-1);
  if (delivered) return `Oddano „${delivered.name}”. Klient już testuje na produkcji.`;
  if (Object.keys(state.contracts.projects).length === 0) {
    return 'Klucze odebrane. Ekspres działa. Teraz potrzebujemy klientów.';
  }
  if (Object.keys(state.staff.employees).length === 0) {
    return 'Kontrakt podpisany. Teraz ktoś musi go zrobić.';
  }
  return 'Klawiatury stukają. Ekspres pracuje na pełnych obrotach.';
}

export function OfficeView({
  sceneRef,
  engine,
  manager,
}: {
  sceneRef: RefObject<HTMLDivElement | null>;
  engine: Engine;
  manager: SaveManager;
}) {
  const title = useGameSelector(headline);
  const news = useGameSelector(officeNews);
  const day = useGameSelector((state) => state.mission.day);

  return (
    <main className="office-main">
      <div className="office-heading">
        <p className="kicker">Dzień {day} / Twój software house</p>
        <h1>
          {title}
          <span className="dot">.</span>
        </h1>
      </div>
      <UpdateBanner engine={engine} manager={manager} />
      <section className="office-card" aria-label="Biuro">
        <div className="office-card-top">
          <span className="office-label kicker">
            <Building2 size={16} /> Nasze biuro
          </span>
          <PauseChip />
        </div>
        <div className="scene-area">
          <div ref={sceneRef} className="scene" />
        </div>
        <OfficeSceneBubble />
        <IntroCard />
        <SelectionPanel />
      </section>
      <DayCard />
      <StaffAlerts />
      <p className="office-log">
        <b>Z życia biura</b>
        <span>{news}</span>
      </p>
    </main>
  );
}

// Szybka pauza/wznowienie na karcie biura (TIME-02); poza dniem pracy niedostępna.
function PauseChip() {
  const speed = useGameSelector((state) => state.mission.speed);
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  const editing = useFurnitureEdit() !== null;
  const dispatch = useDispatch();
  if (!isWorking || editing) return null;
  const paused = speed === 0;
  return (
    <button
      type="button"
      className="pause-chip"
      onClick={() => dispatch({ type: 'SetSpeed', speed: paused ? 1 : 0 })}
    >
      {paused ? <Play size={14} /> : <Pause size={14} />}
      {paused ? 'Wznów' : 'Pauza'}
    </button>
  );
}

// Karta wprowadzająca (wzór SH2): pierwsze kroki, dopóki firma nie ma zespołu i projektu.
function IntroCard() {
  const { open } = useNavigation();
  const selection = useSelection();
  const editing = useFurnitureEdit() !== null;
  const stage = useGameSelector((state) => {
    const hasTeam = Object.keys(state.staff.employees).length > 0;
    const hasProjects = Object.keys(state.contracts.projects).length > 0;
    if (hasTeam && hasProjects) return null;
    return hasProjects ? 'team' : hasTeam ? 'project' : 'start';
  });
  if (!stage || selection || editing) return null;

  const copy = {
    start: {
      title: 'Kawa jest. Brakuje tylko zespołu.',
      text: 'Przyjmij pierwsze zlecenie i zatrudnij ludzi, którzy zamienią kofeinę w kod.',
    },
    project: {
      title: 'Zespół gotowy. Brakuje klienta.',
      text: 'Wybierz zlecenie — zaliczka od razu trafi na konto.',
    },
    team: {
      title: 'Zlecenie przyjęte. Kto to zrobi?',
      text: 'Zatrudnij developerów zakresów z kontraktu i przydziel ich do projektu.',
    },
  }[stage];

  return (
    <aside className="intro-card">
      <span className="intro-icon">
        <Coffee size={22} />
      </span>
      <div>
        <h2>{copy.title}</h2>
        <p>{copy.text}</p>
        <div className="intro-actions">
          {stage !== 'team' && (
            <button type="button" className="primary-button" onClick={() => open('projects')}>
              Znajdź zlecenie <ArrowUpRight size={16} />
            </button>
          )}
          {stage !== 'project' && (
            <button type="button" className="link-button" onClick={() => open('recruit')}>
              Poznaj kandydatów
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
