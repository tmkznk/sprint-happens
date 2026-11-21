import type { GameState } from '../domain/state';
import type { ValidationContext } from '../persistence/schema';
import type { SaveStore } from '../persistence/saveStore';
import { parseSnapshot, serializeSnapshot } from '../persistence/snapshot';
import { beginChapterTwo } from '../simulation/chapters';

export type PreparedChapter =
  | { ok: true; state: GameState; chapterStartJson: string }
  // `detail` — opis dla konsoli i zgłoszenia błędu (gracz widzi ogólny komunikat).
  | { ok: false; reason: 'notAllowed' | 'invalid' | 'failed'; detail: string };

// Rozdział 2 (SH-049): stan startowy rozdziału i jego kopia (do ponowienia po bankructwie).
// Kopia przechodzi pełną walidację zapisu przed użyciem — tak jak zwykły zapis.
export function prepareChapterTwo(
  state: GameState,
  context: ValidationContext,
  buildVersion: string,
  now: string,
): PreparedChapter {
  // Przejście nie może zawieść po cichu (przycisk „Przeprowadzka” nic by nie robił) — wyjątek
  // z silnika wraca jako wynik z opisem.
  let transition: ReturnType<typeof beginChapterTwo>;
  try {
    transition = beginChapterTwo(state, context.config);
  } catch (error) {
    return { ok: false, reason: 'failed', detail: describeError(error) };
  }
  if (!transition.ok) return { ok: false, reason: 'notAllowed', detail: transition.code };
  const serialized = serializeSnapshot(
    transition.state,
    { gameBuildVersion: buildVersion, revision: 0, savedAt: now },
    context,
  );
  if (!serialized.ok) {
    const { code, issues } = serialized.error;
    return { ok: false, reason: 'invalid', detail: [code, ...issues].join('; ') };
  }
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

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
