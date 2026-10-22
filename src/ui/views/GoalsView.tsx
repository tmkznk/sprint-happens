import { MissionGoals } from '../MissionGoals';

// Zakładka „Cel misji” (MIS-03): wszystkie trzy progi naraz, sprawdzane po rozliczeniu dnia.
export function GoalsView() {
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
