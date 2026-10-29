import { Pause, Play } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useDispatch, useGameSelector } from '../application/engineHooks';
import { useFurnitureEdit } from '../application/furnitureEditHooks';
import { SPEEDS, type Speed } from '../domain/state';
import { isClockPhase } from './dayPhase';
import { useNavigation } from './navigation';
import { LOCKS } from './prologue/copy';
import { spotlight, useGuide } from './prologue/hooks';
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
  // TIME-02: tempo działa w przyjściu, pracy i wyjściu; TIME-08: po pracy symulacja stoi.
  // OFF-07: w trybie „Urządź” gra pozostaje wstrzymana do zatwierdzenia lub anulowania.
  const isRunning = useGameSelector((state) => isClockPhase(state.mission.phase));
  const editing = useFurnitureEdit() !== null;
  const dispatch = useDispatch();
  const [message, setMessage] = useState<string | null>(null);
  const resume = useGuide()?.kind === 'resume';
  const { notify } = useNavigation();

  function select(next: Speed) {
    const result = dispatch({ type: 'SetSpeed', speed: next });
    const code = result.ok ? null : result.rejection.code;
    // Prolog: warunek w toaście nad nawigacją, nie w pasku tempa (nie rozpycha karty dnia).
    if (code === 'prologueLocked') {
      notify(LOCKS.speed);
      return;
    }
    setMessage(code ? REJECTION_MESSAGES[code] : null);
  }

  return (
    <div className="speed-controls">
      {SPEEDS.map((value) => (
        <button
          key={value}
          type="button"
          className={spotlight(undefined, resume && value === 1)}
          aria-pressed={speed === value}
          disabled={!isRunning || editing}
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
