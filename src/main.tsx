import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { MovementDemo } from './ui/MovementDemo';
import { SCENARIOS } from './world/movement/scenarios';
import './ui/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Brak elementu #root');

// Pokaz prototypu ruchu (SH-003): ?scene=movement&scenario=<nazwa>
const params = new URLSearchParams(window.location.search);
const demoScenario =
  params.get('scene') === 'movement'
    ? (SCENARIOS.find((s) => s.name === params.get('scenario')) ?? SCENARIOS[0])
    : undefined;

createRoot(root).render(
  <StrictMode>
    {demoScenario ? <MovementDemo scenario={demoScenario} scenarios={SCENARIOS} /> : <App />}
  </StrictMode>,
);
