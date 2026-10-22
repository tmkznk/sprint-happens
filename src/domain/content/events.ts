import type { TechSpecialization } from '../contracts';

// Pula zdarzeń decyzyjnych i scenek (EVT-01–03, decyzja SH-032 A7) — dane treściowe.
// Warunki i skutki są deklaratywne; interpretuje je silnik (src/simulation/events.ts), a interfejs
// opisuje skutki liczbowo przed wyborem (EVT-02). Wartości robocze do balansu w SH-044.

// Warunek wystąpienia zdarzenia. Warunki „projektowe” wybierają też projekt docelowy.
export type EventCondition =
  | { kind: 'activeProjectWith'; specialization: TechSpecialization; minPoints?: number }
  | { kind: 'activeProjectWithout'; specialization: TechSpecialization }
  | { kind: 'deliveredWithinDays'; days: number }
  | { kind: 'hasCoffeeMachine' }
  | { kind: 'minEmployees'; count: number }
  | { kind: 'minCash'; amount: number };

export type EventEffect =
  // Zakres projektu docelowego: + procent obecnego zakresu (zaokrąglone do fragmentu, min. 10 pp).
  | { kind: 'scopePercent'; specialization: TechSpecialization; percent: number }
  // Nowy zakres specjalizacji, której projekt nie miał.
  | { kind: 'addScope'; specialization: TechSpecialization; points: number }
  | { kind: 'rewardPercent'; percent: number }
  | { kind: 'deadlineDays'; days: number }
  | { kind: 'reputation'; delta: number }
  | { kind: 'cash'; amount: number }
  | { kind: 'satisfactionAll'; delta: number }
  // Zebranie: nikt nie pracuje przez podany czas gry.
  | { kind: 'meeting'; seconds: number }
  // Ekspres niedostępny do końca dnia.
  | { kind: 'coffeeBroken' }
  // Wykrycie (jak po testach) do `count` ukrytych błędów specjalizacji w projekcie docelowym.
  | { kind: 'revealBugs'; specialization: TechSpecialization; count: number };

export type EventOption = { id: string; label: string; effects: readonly EventEffect[] };

export type GameEventTemplate = {
  id: string;
  title: string;
  description: string;
  condition: EventCondition;
  options: readonly EventOption[];
};

export const EVENT_TEMPLATES: readonly GameEventTemplate[] = [
  {
    id: 'small-change',
    title: '„Mała zmiana”',
    description:
      'Klient prosi o „jeden przycisk”. Przycisk ma otwierać panel, który ma trzy zakładki.',
    condition: { kind: 'activeProjectWith', specialization: 'frontend' },
    options: [
      {
        id: 'free',
        label: 'Zrobimy w ramach umowy',
        effects: [
          { kind: 'scopePercent', specialization: 'frontend', percent: 25 },
          { kind: 'reputation', delta: 3 },
        ],
      },
      {
        id: 'paid',
        label: 'Wycenimy jako zmianę',
        effects: [
          { kind: 'scopePercent', specialization: 'frontend', percent: 25 },
          { kind: 'rewardPercent', percent: 20 },
          { kind: 'deadlineDays', days: 1 },
        ],
      },
      {
        id: 'refuse',
        label: 'To nie jest mała zmiana',
        effects: [{ kind: 'reputation', delta: -2 }],
      },
    ],
  },
  {
    id: 'maybe-mobile',
    title: '„A może jednak mobile?”',
    description:
      'Klient był na konferencji. Teraz chce też aplikację. „Przecież to ten sam kod, nie?”',
    condition: { kind: 'activeProjectWithout', specialization: 'mobile' },
    options: [
      {
        id: 'yes',
        label: 'Bierzemy',
        effects: [
          { kind: 'addScope', specialization: 'mobile', points: 80 },
          { kind: 'rewardPercent', percent: 30 },
          { kind: 'deadlineDays', days: 2 },
        ],
      },
      { id: 'no', label: 'Może w drugim etapie', effects: [] },
    ],
  },
  {
    id: 'coffee-strike',
    title: '„Ekspres strajkuje”',
    description: 'Ekspres miga trzema diodami. Instrukcja jest po włosku. Zespół patrzy na Ciebie.',
    condition: { kind: 'hasCoffeeMachine' },
    options: [
      { id: 'service', label: 'Wezwij serwis', effects: [{ kind: 'cash', amount: -400 }] },
      { id: 'endure', label: '„Damy radę bez kawy”', effects: [{ kind: 'coffeeBroken' }] },
    ],
  },
  {
    id: 'daily-meeting',
    title: '„Daily, które mogło być mailem”',
    description: 'Ktoś zaprosił wszystkich na „szybkie 15 minut”. Agenda: „ustalimy na miejscu”.',
    condition: { kind: 'minEmployees', count: 3 },
    options: [
      { id: 'attend', label: 'Idziemy', effects: [{ kind: 'meeting', seconds: 30 }] },
      { id: 'cancel', label: 'Odwołaj', effects: [{ kind: 'satisfactionAll', delta: -5 }] },
    ],
  },
  {
    id: 'framework-conference',
    title: '„Konferencja o frameworku sprzed tygodnia”',
    description: 'Framework ma już dwie wersje główne i jeden fork. Bilety w promocji early bird.',
    condition: { kind: 'minCash', amount: 3_000 },
    options: [
      {
        id: 'send',
        label: 'Wyślij zespół',
        effects: [
          { kind: 'cash', amount: -1_500 },
          { kind: 'reputation', delta: 3 },
        ],
      },
      { id: 'skip', label: 'Obejrzymy nagrania', effects: [] },
    ],
  },
  {
    id: 'late-payment',
    title: '„Klient płaci po terminie płatności”',
    description: 'Faktura „utknęła w obiegu”. Obieg składa się z jednej osoby na urlopie.',
    condition: { kind: 'deliveredWithinDays', days: 1 },
    options: [
      { id: 'remind', label: 'Uprzejme przypomnienie', effects: [] },
      {
        id: 'collect',
        label: 'Windykacja',
        effects: [
          { kind: 'cash', amount: 500 },
          { kind: 'reputation', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'security-audit',
    title: '„Audyt bezpieczeństwa”',
    description: 'Klient zamówił audyt. Audytor pyta, czemu hasło do bazy to „admin1”.',
    condition: { kind: 'activeProjectWith', specialization: 'backend', minPoints: 100 },
    options: [
      {
        id: 'pass',
        label: 'Przejdźmy audyt',
        effects: [{ kind: 'revealBugs', specialization: 'backend', count: 2 }],
      },
      { id: 'works-for-us', label: '„U nas działa”', effects: [] },
    ],
  },
  {
    id: 'open-day',
    title: '„Dzień otwarty dla kandydatów”',
    description: 'HR proponuje dzień otwarty. Budżet: pizza i naklejki z logo.',
    condition: { kind: 'minCash', amount: 0 },
    options: [
      {
        id: 'organize',
        label: 'Organizujemy',
        effects: [
          { kind: 'cash', amount: -800 },
          { kind: 'reputation', delta: 2 },
        ],
      },
      { id: 'no', label: 'Nie tym razem', effects: [] },
    ],
  },
];

// EVT-01: scenki biurowe bez decyzji i bez skutków.
export const OFFICE_SCENES: readonly string[] = [
  'Kto zostawił kubek w zmywarce od 2019?',
  'Działa u mnie lokalnie.',
  'Kto ma uprawnienia do produkcji?',
  'Jeszcze tylko jeden hotfix.',
  'Daily przeciągnęło się do lunchu.',
];
