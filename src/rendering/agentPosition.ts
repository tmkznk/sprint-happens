import type { ReadonlyAgent } from '../domain/movement';
import { cellCenter, interpolate } from './projection';

// T:TIME-T02 — pozycja wyświetlana leży między polem źródłowym a docelowym przejścia;
// `alpha` to ułamek bieżącego kroku symulacji. Pozycja logiczna pozostaje bez zmian.
export function displayPosition(agent: ReadonlyAgent, alpha: number, stepsPerCell: number) {
  const from = cellCenter(agent.cell);
  if (!agent.move) return from;
  return interpolate(from, cellCenter(agent.move.to), (agent.move.elapsed + alpha) / stepsPerCell);
}
