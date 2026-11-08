import type { GameState } from '../domain/state';
import type { ValidationContext } from '../persistence/schema';
import type { SaveStore } from '../persistence/saveStore';
import { parseSnapshot, serializeSnapshot } from '../persistence/snapshot';
import { beginChapterTwo } from '../simulation/chapters';

export type PreparedChapter =
  | { ok: true; state: GameState; chapterStartJson: string }
  | { ok: false; reason: 'notAllowed' | 'invalid' };

// Rozdział 2 (SH-049): stan startowy rozdziału i jego kopia (do ponowienia po bankructwie).
// Kopia przechodzi pełną walidację zapisu przed użyciem — tak jak zwykły zapis.
export function prepareChapterTwo(
  state: GameState,
  context: ValidationContext,
  buildVersion: string,
  now: string,
): PreparedChapter {
  const transition = beginChapterTwo(state, context.config);
  if (!transition.ok) return { ok: false, reason: 'notAllowed' };
  const serialized = serializeSnapshot(
    transition.state,
    { gameBuildVersion: buildVersion, revision: 0, savedAt: now },
    context,
  );
  if (!serialized.ok) return { ok: false, reason: 'invalid' };
  return { ok: true, state: transition.state, chapterStartJson: serialized.json };
}

// Kopia startu rozdziału albo null — brak, uszkodzona, niedostępna pamięć.
export async function loadChapterStart(
  store: SaveStore,
  context: ValidationContext,
): Promise<GameState | null> {
  const json = await store.readChapterStart().catch(() => null);
  if (json === null) return null;
  const parsed = parseSnapshot(json, context);
  return parsed.ok ? parsed.envelope.state : null;
}
