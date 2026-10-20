import { useState } from 'react';
import { useDispatch, useGameSelector } from '../application/engineHooks';
import { SPEEDS, type Speed } from '../domain/state';
import type { RejectionCode } from '../simulation/commands';

const LABELS: Record<Speed, string> = { 0: '❚❚', 1: '1×', 2: '2×', 4: '4×' };

const REJECTION_MESSAGES: Record<RejectionCode, string> = {
  missionEnded: 'Misja została zakończona.',
  phaseNotAllowed: 'Dzień pracy się zakończył.',
  invalidSpeed: 'Nieobsługiwane tempo gry.',
};

export function SpeedControls() {
  const speed = useGameSelector((state) => state.mission.speed);
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
          aria-label={value === 0 ? 'Pauza' : `Tempo ${LABELS[value]}`}
          onClick={() => select(value)}
        >
          {LABELS[value]}
        </button>
      ))}
      {message && <span role="alert">{message}</span>}
    </div>
  );
}
