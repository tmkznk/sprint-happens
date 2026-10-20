import { useEffect, useRef, useState } from 'react';
import { EngineContext } from '../application/engineHooks';
import { startGameLoop } from '../application/gameLoop';
import { createSelectionStore } from '../application/selection';
import { SelectionContext } from '../application/selectionHooks';
import { DEFAULT_BALANCE } from '../domain/config';
import { createInitialState } from '../domain/state';
import { createOfficeGame } from '../rendering/createOfficeGame';
import { createEngine } from '../simulation/engine';
import { DayClock } from './DayClock';
import { DayControls } from './DayControls';
import { DayReportDialog } from './DayReportDialog';
import { SelectionPanel } from './SelectionPanel';
import { SpeedControls } from './SpeedControls';

// Scena testowa okluzji dla SH-002: ?scene=occlusion
const occlusionTest = new URLSearchParams(window.location.search).get('scene') === 'occlusion';

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

export function App() {
  const [engine] = useState(() =>
    createEngine({
      config: DEFAULT_BALANCE,
      initialState: createInitialState(DEFAULT_BALANCE, randomSeed()),
    }),
  );
  const [selection] = useState(createSelectionStore);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => startGameLoop(engine), [engine]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const game = createOfficeGame(sceneRef.current, engine, selection, { occlusionTest });
    // VIEW-05: jedna instancja na aktywną grę, pełne sprzątanie przy odmontowaniu.
    return () => game.destroy(true);
  }, [engine, selection]);

  return (
    <EngineContext value={engine}>
      <SelectionContext value={selection}>
        <div className="app">
          <div className="scene-area">
            <div ref={sceneRef} className="scene" />
            <SelectionPanel />
            <DayReportDialog />
          </div>
          <div className="panel">
            <DayClock />
            <SpeedControls />
            <DayControls />
          </div>
        </div>
      </SelectionContext>
    </EngineContext>
  );
}
