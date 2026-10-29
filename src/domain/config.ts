import type { WageTable } from './employees';
import type { FurnitureType } from './furniture';
import { DEFAULT_MOVEMENT_CONFIG, type MovementConfig } from './movement';
import type { DeepReadonly } from './readonly';

// Konfiguracja balansu jest oddzielona od stanu misji: stan nie przechowuje jej kopii,
// a silnik otrzymuje ją przy tworzeniu (SH-006). Kwoty są liczbami całkowitymi.
export type BalanceConfig = DeepReadonly<{
  simulation: {
    // T:TIME-T01 (R): długość kroku w ms czasu gry; musi dzielić długość dnia.
    stepMs: number;
    // R: limit czasu (s czasu gry) na dojście postaci do celu w fazach przyjścia i wyjścia.
    maxTransitSeconds: number;
  };
  // T:MOVE-05, MOVE-09 (R): tempo ruchu i parametry rozwiązywania blokad (SH-003).
  movement: MovementConfig;
  mission: {
    // MIS-02 (B): kilka dni utrzymania małego zespołu — roboczo ustalone w SH-032.
    startingCash: number;
    // MIS-03 (Z/B), decyzja SH-032 A2: trzy progi zwycięstwa spełnione jednocześnie.
    victory: { deliveredProjects: number; cash: number; reputation: number };
  };
  finance: {
    // FIN-02 (B): stałe koszty biura za dzień (SH-032).
    officeUpkeepPerDay: number;
  };
  staff: {
    // EMP-02 (B): pensja dzienna zależy od seniority (SH-032).
    dailyWage: WageTable;
    // EMP-02, PROJ-09, decyzja SH-032 B1 (B): punkty pracy na pełny dzień aktywnej pracy.
    workPointsPerDay: WageTable;
  };
  // BUG-01, BUG-06, decyzje SH-004 B1 i SH-032 B1/B2 (B): fragment pracy i ryzyko ukrytego błędu
  // na fragment przy pełnej energii; ryzyko × (1 + (1 − energia)).
  bugs: {
    fragmentPoints: number;
    riskPerFragment: WageTable;
    // BUG-05, SH-032 B6 (B): tempo testów QA w punktach pracy na pełny dzień.
    testPointsPerDay: WageTable;
    // BUG-06, SH-032 B6 (B): stały koszt naprawy wykrytego błędu w punktach pracy.
    repairPoints: number;
  };
  // NEED-01, NEED-02, decyzje SH-004 A3/A4 i SH-032 B2 (B). Energia w skali 0–100, czas w sekundach gry.
  energy: {
    drainPerSecond: number;
    // Progi przerw (rosnąco: wyczerpanie < zmęczenie < profilaktyka) i koniec odpoczynku na kanapie.
    thresholds: { exhausted: number; tired: number; prophylactic: number; rested: number };
    coffeeGain: number;
    coffeeSeconds: number;
    sofaGainPerSecond: number;
    maxRestSeconds: number;
    // Decyzja właściciela 3c (B): minimalny czas odpoczynku na kanapie z rozkazu gracza.
    minOrderedSofaSeconds: number;
    // Przy zmęczeniu kawa także wtedy, gdy w kolejce do ekspresu czeka najwyżej tyle osób.
    shortQueue: number;
  };
  // NEED-03, NEED-05, decyzja SH-032 B3 (B): zadowolenie i odejścia.
  satisfaction: {
    neutral: number;
    recoveryPerMinute: number;
    declinePerMinute: number;
    toleranceSeconds: number;
    warningThreshold: number;
    quitAfterSeconds: number;
  };
  // EVT-03, decyzja SH-032 A7b (B): częstotliwość zdarzeń decyzyjnych.
  events: {
    dailyChance: number;
    firstDay: number;
    cooldownDays: number;
    // Okno dnia (ułamki długości dnia), w którym może wystąpić zdarzenie.
    windowStart: number;
    windowEnd: number;
  };
  contracts: {
    // CON-01 (Z): liczba ofert na tablicy.
    boardSize: number;
    // PROJ-09 (B): punkty pracy (pp) na jeden punkt zakresu z katalogu zleceń. Wynik musi być
    // wielokrotnością fragmentu (`bugs.fragmentPoints`) — zakres zaokrągla się w górę.
    pointsPerCatalogPoint: number;
    // PROJ-11, decyzja SH-032 B6 (B): premia PM-a do wydajności całego zespołu projektu.
    pmBonus: WageTable;
  };
  // REP-01–04, BUG-04, PROJ-10, decyzja SH-032 B7 (B): ocena oddanego projektu.
  reputation: {
    initial: number;
    // Terminowość: premia za oddanie w terminie, kara za każdy rozpoczęty dzień opóźnienia.
    onTimeBonus: number;
    latePenaltyPerDay: number;
    // Jakość = max(0, 1 − gęstość / bugsPer100ForZero); gęstość = błędy na 100 pp zakresu.
    bugsPer100ForZero: number;
    // Składnik jakości = round(qualityWeight × (jakość − qualityPivot)).
    qualityWeight: number;
    qualityPivot: number;
  };
  furniture: {
    // FIN-02 (B): cena zakupu wyposażenia (SH-032).
    prices: Record<FurnitureType, number>;
    // OFF-06 (B): udział ceny zakupu zwracany przy sprzedaży.
    saleRefundRatio: number;
  };
}>;

export const DEFAULT_BALANCE: BalanceConfig = {
  simulation: {
    stepMs: 100,
    maxTransitSeconds: 60,
  },
  movement: DEFAULT_MOVEMENT_CONFIG,
  mission: {
    startingCash: 15_000,
    victory: { deliveredProjects: 6, cash: 60_000, reputation: 65 },
  },
  finance: {
    officeUpkeepPerDay: 1_000,
  },
  staff: {
    dailyWage: { junior: 300, mid: 500, senior: 800 },
    workPointsPerDay: { junior: 60, mid: 90, senior: 120 },
  },
  bugs: {
    fragmentPoints: 10,
    riskPerFragment: { junior: 0.3, mid: 0.18, senior: 0.08 },
    testPointsPerDay: { junior: 80, mid: 120, senior: 160 },
    repairPoints: 5,
  },
  energy: {
    drainPerSecond: 0.15,
    thresholds: { exhausted: 15, tired: 35, prophylactic: 60, rested: 90 },
    coffeeGain: 15,
    coffeeSeconds: 20,
    sofaGainPerSecond: 1,
    maxRestSeconds: 90,
    minOrderedSofaSeconds: 20,
    shortQueue: 1,
  },
  events: {
    dailyChance: 0.35,
    firstDay: 3,
    cooldownDays: 5,
    windowStart: 0.25,
    windowEnd: 0.75,
  },
  satisfaction: {
    neutral: 70,
    recoveryPerMinute: 1,
    declinePerMinute: 2,
    toleranceSeconds: 60,
    warningThreshold: 25,
    quitAfterSeconds: 600,
  },
  contracts: {
    boardSize: 3,
    pointsPerCatalogPoint: 10,
    pmBonus: { junior: 0.1, mid: 0.15, senior: 0.2 },
  },
  reputation: {
    initial: 50,
    onTimeBonus: 4,
    latePenaltyPerDay: 3,
    bugsPer100ForZero: 5,
    qualityWeight: 20,
    qualityPivot: 0.8,
  },
  furniture: {
    prices: { desk: 2_000, sofa: 1_500, coffeeMachine: 800, plant: 300 },
    saleRefundRatio: 0.5,
  },
};
