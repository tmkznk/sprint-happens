import { useGameSelector } from '../application/engineHooks';
import { OFFICE_SCENES } from '../domain/content/events';

const SCENE_PERIOD_MS = 120_000;
const SCENE_VISIBLE_MS = 20_000;

// EVT-01 (Z): scenki biurowe bez decyzji i bez skutków — czysto prezentacyjne, wyliczane z dnia
// i chwili dnia (bez stanu, więc nie trafiają do zapisu i nie zależą od tempa).
export function OfficeSceneBubble() {
  const text = useGameSelector((state) => {
    if (Object.keys(state.staff.employees).length === 0) return null;
    const { day, timeInDayMs } = state.mission;
    const slot = Math.floor(timeInDayMs / SCENE_PERIOD_MS);
    if (timeInDayMs % SCENE_PERIOD_MS >= SCENE_VISIBLE_MS || slot === 0) return null;
    return OFFICE_SCENES[(day * 3 + slot) % OFFICE_SCENES.length] ?? null;
  });
  if (!text) return null;
  return (
    <p className="office-scene" aria-live="polite">
      💬 {text}
    </p>
  );
}
