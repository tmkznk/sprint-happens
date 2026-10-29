import { DEFAULT_BALANCE, type BalanceConfig } from '../domain/config';
import type { ContractTerms } from '../domain/contracts';
import { createInitialState, type DayPhase, type DayReport, type GameState } from '../domain/state';
import { createEngine, type Engine } from '../simulation/engine';
import { deepFreeze } from './deepFreeze';

export const TEST_SEED = 12345;

// Stała oferta testowa niezależna od katalogu zleceń (który zmienia się przy balansie):
// mały projekt Frontend 60 + Backend 40 pp na 3 dni. Testy reguł liczą na tych liczbach.
export const TEST_OFFER_TERMS: ContractTerms = {
  templateId: 'test-offer',
  name: 'Projekt testowy',
  description: 'Stałe warunki do testów silnika.',
  scopes: { frontend: 60, backend: 40 },
  designImportance: 1,
  designScope: 20,
  deadlineDays: 3,
  reward: 7_000,
  advance: 2_100,
  latePenaltyPerDay: 700,
};

// Podmienia pierwszą ofertę tablicy (gwarantowaną startową) na ofertę testową.
export function withTestOffer(state: GameState): GameState {
  const [first, ...rest] = state.contracts.offers;
  if (!first) return state;
  return {
    ...state,
    contracts: { ...state.contracts, offers: [{ ...TEST_OFFER_TERMS, id: first.id }, ...rest] },
  };
}

export function testState(missionPatch: Partial<GameState['mission']> = {}): GameState {
  const initial = withTestOffer(createInitialState(DEFAULT_BALANCE, TEST_SEED));
  return deepFreeze({ ...initial, mission: { ...initial.mission, ...missionPatch } });
}

export function testEngine(
  missionPatch: Partial<GameState['mission']> = {},
  config: BalanceConfig = DEFAULT_BALANCE,
) {
  return createEngine({ config, initialState: testState(missionPatch) });
}

// Raport rozliczenia dla stanów testowych w fazie `settled`.
export function testReport(day: number, cashAfterSettlement: number): DayReport {
  return {
    day,
    income: 0,
    spending: 0,
    wages: 0,
    upkeep: 0,
    cashAfterSettlement,
    rescueDeadlineDay: null,
  };
}

// Kroki symulacji do osiągnięcia fazy dnia (np. `workEnded` po wyjściu wszystkich z biura).
// Tempa nie zmienia — stan na pauzie nie ruszy i po limicie kończy się błędem.
export function runUntilPhase(engine: Engine, phase: DayPhase, maxSteps = 20_000): void {
  for (let i = 0; i < maxSteps; i++) {
    if (engine.getState().mission.phase === phase) return;
    engine.step();
  }
  const { mission } = engine.getState();
  if (mission.phase !== phase) {
    throw new Error(
      `Brak fazy ${phase} po ${maxSteps} krokach (jest ${mission.phase}, tempo ${mission.speed})`,
    );
  }
}
