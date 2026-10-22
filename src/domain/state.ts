import type { BalanceConfig } from './config';
import { fillBoard } from './contractBoard';
import type { Offer, Project, ProjectId } from './contracts';
import {
  generateMarket,
  type Candidate,
  type Departure,
  type Employee,
  type EmployeeId,
} from './employees';
import type { Finance } from './finance';
import type { Furniture, FurnitureId } from './furniture';
import { allocateId, type IdSequence } from './ids';
import { STARTING_FURNITURE } from './missionStart';
import { createMovementState, type MovementState } from './movement';
import { seedRng, type RngState } from './random';
import type { DeepReadonly } from './readonly';

// TIME-02 (Z): pauza, 1×, 2×, 4×. Zero oznacza pauzę.
export const SPEEDS = [0, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

// TIME-08 (Z): dzień pracy → koniec pracy (przegląd i oddania) → po rozliczeniu (raport).
export type DayPhase = 'working' | 'workEnded' | 'settled';

// TIME-03 (Z): podsumowanie dnia — przepływy z księgi bieżącego dnia i stan po rozliczeniu.
// Terminy projektów dojdą wraz z kontraktami (SH-020, SH-026).
export type DayReport = {
  day: number;
  // Wpływy dnia (zaliczki, płatności, sprzedaż, zdarzenia na plus).
  income: number;
  // Wydatki dnia poza kosztami obowiązkowymi (zakupy, zdarzenia na minus).
  spending: number;
  // FIN-02, FIN-03: pobrane przy rozliczeniu.
  wages: number;
  upkeep: number;
  cashAfterSettlement: number;
  // FIN-05: ostatni dzień okresu ratunkowego albo null, gdy saldo jest nieujemne.
  rescueDeadlineDay: number | null;
};

// MIS-03 (Z): zwycięstwo i bankructwo kończą misję.
export type MissionStatus = 'active' | 'won' | 'bankrupt';

// EVT-01–03 (Z): stan zdarzeń — zapisywany, aby wczytanie nie przelosowało ani nie powtórzyło
// zdarzenia, a oczekująca decyzja przetrwała zamknięcie gry.
export type PendingEvent = {
  instanceId: string;
  templateId: string;
  // Projekt, którego dotyczą skutki (wybrany przy wystąpieniu); null — zdarzenie ogólne.
  projectId: ProjectId | null;
  // Tempo sprzed automatycznej pauzy — przywracane po wyborze (EVT-02).
  resumeSpeed: Speed;
};

export type EventsState = {
  // Moment zdarzenia w bieżącym dniu (ms czasu gry) albo null — dziś bez zdarzenia.
  scheduledAtMs: number | null;
  pending: PendingEvent | null;
  // Dzień ostatniego wystąpienia każdego szablonu (odstęp między powtórzeniami).
  lastSeenDay: Record<string, number>;
  // Skutki trwające: zebranie do podanej chwili dnia; ekspres zepsuty w podanym dniu.
  meetingUntilMs: number | null;
  coffeeBrokenDay: number | null;
};

export type GameState = DeepReadonly<{
  mission: {
    status: MissionStatus;
    day: number;
    phase: DayPhase;
    speed: Speed;
    // Upływ bieżącego dnia w ms czasu gry; rośnie wyłącznie o pełne kroki symulacji.
    timeInDayMs: number;
    // Raport rozliczenia bieżącego dnia; w stanie, aby przetrwał zapis (SAVE-T04).
    report: DayReport | null;
    // REP-01 (Z): jeden wskaźnik 0–100; nie odblokowuje ofert (CON-04).
    reputation: number;
  };
  finance: Finance;
  contracts: {
    // CON-01: oferty na tablicy; nieprzyjęte pozostają.
    offers: Offer[];
    projects: Record<ProjectId, Project>;
    // SH-032 A3b: liczba oddanych projektów wyznacza poziom ofert.
    deliveredCount: number;
  };
  staff: {
    employees: Record<EmployeeId, Employee>;
    // EMP-03: rynek kandydatów — zawsze każda specjalizacja w każdym seniority.
    candidates: Candidate[];
    // EMP-08, NEED-05: historia odejść (do komunikatów w interfejsie).
    departures: Departure[];
  };
  world: {
    furniture: Record<FurnitureId, Furniture>;
    // T:MOVE-03–09: pozycje, przejścia, trasy, kolejki i rezerwacje postaci (SAVE-T02).
    movement: MovementState;
  };
  events: EventsState;
  ids: IdSequence;
  rng: RngState;
}>;

// MIS-01 (Z): misja startuje na pauzie, bez pracowników, ze startowym wyposażeniem.
// Ziarno dostarcza warstwa aplikacji; silnik nie sięga po losowość ani czas systemowy.
export function createInitialState(config: BalanceConfig, seed: number): GameState {
  let ids: IdSequence = {};
  const furniture: Record<FurnitureId, Furniture> = {};
  for (const placement of STARTING_FURNITURE) {
    const allocated = allocateId(ids, 'furniture');
    ids = allocated.sequence;
    furniture[allocated.id] = { ...placement, id: allocated.id };
  }

  const market = generateMarket(ids, seedRng(seed), config.staff.dailyWage);
  const board = fillBoard({ offers: [], ids: market.ids, rng: market.rng }, 0, config, {
    guaranteeStarter: true,
  });

  return {
    mission: {
      status: 'active',
      day: 1,
      phase: 'working',
      speed: 0,
      timeInDayMs: 0,
      report: null,
      reputation: config.reputation.initial,
    },
    finance: {
      openingCash: config.mission.startingCash,
      cash: config.mission.startingCash,
      ledger: [],
      wagesDueToday: {},
      rescueDeadlineDay: null,
    },
    contracts: { offers: board.offers, projects: {}, deliveredCount: 0 },
    staff: { employees: {}, candidates: market.candidates, departures: [] },
    world: { furniture, movement: createMovementState([]) },
    events: {
      scheduledAtMs: null,
      pending: null,
      lastSeenDay: {},
      meetingUntilMs: null,
      coffeeBrokenDay: null,
    },
    ids: board.ids,
    rng: board.rng,
  };
}
