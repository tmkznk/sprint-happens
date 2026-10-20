import { useEffect, useRef } from 'react';
import { createMovementDemoGame } from '../rendering/createMovementDemoGame';
import type { Scenario } from '../world/movement/scenarios';

const LEGEND = [
  ['#ff8c1a', 'ustępuje'],
  ['#9a9a9a', 'czeka'],
  ['#4e7cf2', 'w kolejce'],
  ['#3ddc84', 'korzysta'],
  ['#ff3b3b', 'blokada'],
] as const;

// Pokaz scenariuszy ruchu z prototypu SH-003.
export function MovementDemo({
  scenario,
  scenarios,
}: {
  scenario: Scenario;
  scenarios: readonly Scenario[];
}) {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sceneRef.current) return;
    const game = createMovementDemoGame(sceneRef.current, scenario);
    return () => game.destroy(true);
  }, [scenario]);

  return (
    <div className="app">
      <div className="scene-area">
        <div ref={sceneRef} className="scene" />
      </div>
      <div className="panel movement-demo">
        <p>
          <strong>{scenario.name}</strong> — {scenario.description}
        </p>
        <ul className="legend">
          {LEGEND.map(([color, label]) => (
            <li key={label}>
              <span style={{ background: color }} /> {label}
            </li>
          ))}
        </ul>
        <nav>
          {scenarios.map((item) => (
            <a
              key={item.name}
              href={`?scene=movement&scenario=${item.name}`}
              aria-current={item.name === scenario.name ? 'page' : undefined}
            >
              {item.name}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
