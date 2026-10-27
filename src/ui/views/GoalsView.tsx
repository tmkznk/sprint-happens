import { MissionGoals } from '../MissionGoals';
import { usePrologueStep } from '../prologue/hooks';
import { PrologueGoalsView } from '../prologue/PrologueViews';

// Zakładka „Cel misji” (MIS-03): wszystkie trzy progi naraz, sprawdzane po rozliczeniu dnia.
// W prologu — bieżący krok samouczka i jego cele.
export function GoalsView({ onSkipPrologue }: { onSkipPrologue(): void }) {
  const prologue = usePrologueStep() !== null;
  if (prologue) return <PrologueGoalsView onSkip={onSkipPrologue} />;
  return (
    <>
      <p className="hint">
        Dowieź projekty, zbuduj reputację i nie zbankrutuj po drodze. Zwycięstwo wymaga spełnienia
        wszystkich trzech progów naraz — sprawdzamy je po rozliczeniu dnia.
      </p>
      <section className="card">
        <MissionGoals />
      </section>
    </>
  );
}
