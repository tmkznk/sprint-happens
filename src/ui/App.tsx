import { useEffect, useRef, useState } from 'react';
import { EngineContext } from '../application/engineHooks';
import { startGameLoop } from '../application/gameLoop';
import { DEFAULT_BALANCE } from '../domain/config';
import { createInitialState } from '../domain/state';
import { createOfficeGame } from '../rendering/createOfficeGame';
import { createEngine } from '../simulation/engine';
import { DayClock } from './DayClock';
import { SpeedControls } from './SpeedControls';

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
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => startGameLoop(engine), [engine]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const game = createOfficeGame(sceneRef.current);
    // VIEW-05: jedna instancja na aktywną grę, pełne sprzątanie przy odmontowaniu.
    return () => game.destroy(true);
  }, []);

  return (
    <EngineContext value={engine}>
      <div className="app">
        <div ref={sceneRef} className="scene" />
        <div className="panel">
          <DayClock />
          <SpeedControls />
        </div>
      </div>
    </EngineContext>
  );
}
