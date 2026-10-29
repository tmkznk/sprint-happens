import { useGameSelector } from '../application/engineHooks';
import { officeSceneText } from './officeScene';

export function OfficeSceneBubble() {
  const text = useGameSelector(officeSceneText);
  if (!text) return null;
  return (
    <p className="office-scene" aria-live="polite">
      💬 {text}
    </p>
  );
}
