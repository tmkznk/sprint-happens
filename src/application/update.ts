import type { Engine } from '../simulation/engine';
import type { SaveManager } from './saveManager';

export type UpdateResult = 'updating' | 'saveFailed' | 'noUpdate';

// T:PWA-T02, PWA-T03 (SH-041): „Zapisz i zaktualizuj” — pauza, zapis i dopiero po jego
// potwierdzeniu aktywacja nowej wersji (przeładowanie). Nieudany zapis blokuje aktualizację;
// po przeładowaniu nowa wersja wczytuje zapis (z migracją, jeśli potrzebna — SH-039).
export async function saveAndUpdate(
  engine: Engine,
  manager: Pick<SaveManager, 'flush'>,
  applyUpdate: () => boolean,
): Promise<UpdateResult> {
  if (engine.getState().mission.speed !== 0) engine.dispatch({ type: 'SetSpeed', speed: 0 });
  if (!(await manager.flush())) return 'saveFailed';
  return applyUpdate() ? 'updating' : 'noUpdate';
}
