import { Pause, Play } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useDispatch, useGameSelector } from '../application/engineHooks';
import { useFurnitureEdit } from '../application/furnitureEditHooks';
import { SPEEDS, type Speed } from '../domain/state';
import { REJECTION_MESSAGES } from './rejectionMessages';

const LABELS: Record<Speed, ReactNode> = {
  0: <Pause size={18} />,
  1: <Play size={18} />,
  2: '2×',
  4: '4×',
};
const NAMES: Record<Speed, string> = { 0: 'Pauza', 1: 'Tempo 1×', 2: 'Tempo 2×', 4: 'Tempo 4×' };

export function SpeedControls() {
  const speed = useGameSelector((state) => state.mission.speed);
  // TIME-08: poza dniem pracy symulacja stoi — tempo nie jest dostępne.
  // OFF-07: w trybie „Urządź” gra pozostaje wstrzymana do zatwierdzenia lub anulowania.
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  const editing = useFurnitureEdit() !== null;
  const dispatch = useDispatch();
  const [message, setMessage] = useState<string | null>(null);

  function select(next: Speed) {
    const result = dispatch({ type: 'SetSpeed', speed: next });
    setMessage(result.ok ? null : REJECTION_MESSAGES[result.rejection.code]);
  }

  return (
    <div className="speed-controls">
      {SPEEDS.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={speed === value}
          disabled={!isWorking || editing}
          aria-label={NAMES[value]}
          onClick={() => select(value)}
        >
          {LABELS[value]}
        </button>
      ))}
      {message && (
        <span role="alert" className="warning">
          {message}
        </span>
      )}
    </div>
  );
}
