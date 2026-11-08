import { useGameSelector } from '../application/engineHooks';
import { retroCardById } from '../domain/content/retroCards';
import type { RetroCardId } from '../domain/scrum';
import { scrumMasterOf } from '../simulation/scrum';
import { cardSummary, ceremonyLabel, goalLabel, scrumHint, sprintDayLabel } from './sprintDisplay';

// SH-058: sprint w panelu celów (rozdział 2) — dzień sprintu, cel, trwająca ceremonia i aktywne
// usprawnienia; bez sprintu — czego brakuje. Selektory zwracają teksty.
export function SprintPanel() {
  const chapterTwo = useGameSelector((state) => state.scrum !== null);
  const day = useGameSelector((state) => {
    const sprint = state.scrum?.sprint;
    return sprint ? sprintDayLabel(sprint, state.mission.day) : '';
  });
  const goal = useGameSelector((state) => {
    const sprint = state.scrum?.sprint;
    if (!sprint) return '';
    const project = sprint.goalProjectId
      ? state.contracts.projects[sprint.goalProjectId]
      : undefined;
    return goalLabel(sprint, project?.name ?? null);
  });
  const meeting = useGameSelector((state) => {
    const ceremony = state.scrum?.meeting?.ceremony;
    return ceremony ? ceremonyLabel(ceremony) : '';
  });
  const hint = useGameSelector((state) => {
    if (!state.scrum || state.scrum.sprint) return '';
    const sm = scrumMasterOf(state);
    return scrumHint({
      scrumMaster: !!sm,
      scrumMasterDesk: !!sm?.deskId,
      table: Object.values(state.world.furniture).some((f) => f.type === 'conferenceTable'),
    });
  });
  const cards = useGameSelector((state) => state.scrum?.cards.join(',') ?? '');
  if (!chapterTwo) return null;

  return (
    <section className="plan-section sprint-panel" aria-label="Sprint">
      <header>
        <h3>{day || 'Scrum'}</h3>
      </header>
      {hint && <p className="hint">{hint}</p>}
      {goal && <p>{goal}</p>}
      {meeting && <p className="hint">Zespół jest teraz {meeting.replace(/^Na /, 'na ')}.</p>}
      {cards && (
        <ul className="sprint-cards">
          {(cards.split(',') as RetroCardId[]).map((id) => {
            const card = retroCardById(id);
            return card ? (
              <li key={id}>
                <strong>{card.title}</strong> — {cardSummary(card)}
              </li>
            ) : null;
          })}
        </ul>
      )}
    </section>
  );
}
