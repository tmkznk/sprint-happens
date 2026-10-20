import { useEffect, useRef, useState } from 'react';
import { EngineContext } from '../application/engineHooks';
import { DEFAULT_BALANCE } from '../domain/config';
import { createOfficeGame } from '../rendering/createOfficeGame';
import { createEngine } from '../simulation/engine';
import { SpeedControls } from './SpeedControls';

export function App() {
  const [engine] = useState(() => createEngine({ config: DEFAULT_BALANCE }));
  const sceneRef = useRef<HTMLDivElement>(null);

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
          <SpeedControls />
        </div>
      </div>
    </EngineContext>
  );
}
