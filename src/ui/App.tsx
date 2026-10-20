import { useEffect, useRef } from 'react';
import { createOfficeGame } from '../rendering/createOfficeGame';

export function App() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sceneRef.current) return;
    const game = createOfficeGame(sceneRef.current);
    // VIEW-05: jedna instancja na aktywną grę, pełne sprzątanie przy odmontowaniu.
    return () => game.destroy(true);
  }, []);

  return (
    <div className="app">
      <div ref={sceneRef} className="scene" />
      <div className="panel">Panel zarządczy</div>
    </div>
  );
}
