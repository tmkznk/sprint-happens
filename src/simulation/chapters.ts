import type { BalanceConfig } from '../domain/config';
import { fillMarket, type Employee } from '../domain/employees';
import type { FurnitureType } from '../domain/furniture';
import { createMovementState } from '../domain/movement';
import type { GameState } from '../domain/state';
import { startNextDay } from './commands/startNextDay';
import { maxTransitSteps } from './commute';
import { advanceStep } from './step';

export type ChapterTransition =
  { ok: true; state: GameState } | { ok: false; code: 'notWon' | 'notChapterOne' };

// Rozdział 2 (SH-049): ta sama firma przenosi się do większego biura. Przechodzą pracownicy
// (bez biurek, z przydziałami), gotówka, reputacja i rozpoczęte projekty; meble jadą do magazynu,
// rynek kandydatów i tablica zleceń losują się od nowa (RNG ze stanu — deterministycznie).
// To nie polecenie: wygrana misja odrzuca polecenia, a przejście tworzy nowy stan startowy.
// Na koniec zwykłe „Następny dzień” (pełna energia, dniówki, oferty) i od razu odegrane przyjście:
// rozdział startuje o 9:00, na pauzie, z zespołem w biurze — urządzanie jest dozwolone tylko
// w dniu pracy, a biuro jest puste (meble w magazynie).
export function beginChapterTwo(state: GameState, config: BalanceConfig): ChapterTransition {
  if (state.mission.status !== 'won' || state.prologue) return { ok: false, code: 'notWon' };
  if (state.mission.chapter !== 1) return { ok: false, code: 'notChapterOne' };

  const storage: Partial<Record<FurnitureType, number>> = { ...state.world.storage };
  for (const item of Object.values(state.world.furniture)) {
    storage[item.type] = (storage[item.type] ?? 0) + 1;
  }

  const employees = Object.fromEntries(
    Object.values(state.staff.employees).map((employee): [string, Employee] => [
      employee.id,
      { ...employee, deskId: null, breakHold: false, orderedRest: false, badConditionsMs: 0 },
    ]),
  ) as GameState['staff']['employees'];

  const market = fillMarket(
    { candidates: [], ids: state.ids, rng: state.rng },
    Object.values(employees),
    config.staff.dailyWage,
  );

  const moved: GameState = {
    ...state,
    mission: { ...state.mission, status: 'active', chapter: 2 },
    contracts: { ...state.contracts, offers: [], chapterDeliveredCount: 0 },
    staff: { ...state.staff, employees, candidates: market.candidates, entryQueue: [] },
    world: { furniture: {}, movement: createMovementState([]), storage },
    events: {
      ...state.events,
      scheduledAtMs: null,
      pending: null,
      meetingUntilMs: null,
      coffeeBrokenDay: null,
    },
    ids: market.ids,
    rng: market.rng,
  };
  const outcome = startNextDay.execute(moved, { type: 'StartNextDay' }, config);
  if (!outcome.ok) throw new Error(`Nie można rozpocząć rozdziału 2: ${outcome.rejection.code}`);
  let arrived: GameState = { ...outcome.state, mission: { ...outcome.state.mission, speed: 1 } };
  for (let i = 0; i <= maxTransitSteps(config) && arrived.mission.phase === 'arriving'; i++) {
    arrived = advanceStep(arrived, config);
  }
  return { ok: true, state: { ...arrived, mission: { ...arrived.mission, speed: 0 } } };
}
