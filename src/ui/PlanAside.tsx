import { ArrowUpRight, Briefcase, UserPlus } from 'lucide-react';
import { useGameSelector } from '../application/engineHooks';
import { progressPercent } from '../simulation/work';
import { TECH_SPECIALIZATIONS } from '../domain/contracts';
import { MissionGoals } from './MissionGoals';
import { useNavigation } from './navigation';

// Desktop (SH-033, wzór SH2): „Plan na dzisiaj” — cele misji, projekty w toku, rekrutacja.
export function PlanAside() {
  const { open } = useNavigation();
  const projects = useGameSelector((state) => state.contracts.projects);
  const active = Object.values(projects).filter((p) => p.status === 'active');

  return (
    <aside className="plan" aria-label="Plan na dzisiaj">
      <div>
        <p className="kicker">Plan na dzisiaj</p>
        <h2>
          Mały krok.
          <br />
          Wielki software house.
        </h2>
        <p>Dowieź projekty. Zbuduj reputację. Nie zbankrutuj po drodze.</p>
      </div>
      <MissionGoals />
      <section className="plan-section">
        <header>
          <h3>W toku</h3>
          <button type="button" className="link-button" onClick={() => open('projects')}>
            Wszystkie <ArrowUpRight size={14} />
          </button>
        </header>
        {active.length === 0 ? (
          <div className="empty-state">
            <Briefcase size={28} />
            <p>
              Jeszcze spokojnie.
              <br />
              To dobry moment na zlecenie.
            </p>
            <button type="button" className="link-button" onClick={() => open('projects')}>
              Przeglądaj oferty <ArrowUpRight size={14} />
            </button>
          </div>
        ) : (
          <ul className="goal-list">
            {active.map((project) => {
              const scopes = TECH_SPECIALIZATIONS.filter((s) => project.scopes[s] !== undefined);
              const done = Math.floor(
                scopes.reduce((sum, s) => sum + progressPercent(project, s), 0) /
                  Math.max(1, scopes.length),
              );
              return (
                <li key={project.id}>
                  <div>
                    <span>{project.name}</span>
                    <strong>{done}%</strong>
                  </div>
                  <span className="bar">
                    <span style={{ width: `${done}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="cta-card">
        <h3>Ludzie robią różnicę.</h3>
        <p>Pierwszy commit nie zrobi się sam.</p>
        <button type="button" className="secondary-button" onClick={() => open('recruit')}>
          <UserPlus size={18} /> Rekrutuj
        </button>
      </section>
    </aside>
  );
}
