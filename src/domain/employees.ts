import { PEOPLE, type PersonId } from './content/people';
import type { ProjectId } from './contracts';
import type { FurnitureId } from './furniture';
import { allocateId, type EntityId, type IdSequence } from './ids';
import { nextRandom, type RngState } from './random';

// EMP-01 (Z): dwie niezależne cechy — specjalizacja i seniority (stałe w całej misji).
export const SPECIALIZATIONS = [
  'frontend',
  'backend',
  'mobile',
  'devops',
  'qa',
  'designer',
  'pm',
] as const;
export type Specialization = (typeof SPECIALIZATIONS)[number];

export const SENIORITIES = ['junior', 'mid', 'senior'] as const;
export type Seniority = (typeof SENIORITIES)[number];

export type EmployeeId = EntityId<'employee'>;
export type CandidateId = EntityId<'candidate'>;

export type Candidate = {
  id: CandidateId;
  // Postać z listy (imię, opis, awatar); imię kopiowane dla czytelności zapisu i historii odejść.
  personId: PersonId;
  name: string;
  specialization: Specialization;
  seniority: Seniority;
  // EMP-03: gracz widzi pensję dzienną przed zatrudnieniem.
  dailyWage: number;
};

export type Employee = {
  id: EmployeeId;
  personId: PersonId;
  name: string;
  specialization: Specialization;
  seniority: Seniority;
  dailyWage: number;
  hiredOnDay: number;
  // OFF-04 (Z): jedno biurko na osobę; null — zatrudniony bez stanowiska (EMP-04).
  deskId: FurnitureId | null;
  // EMP-05 (Z): jeden aktywny przydział do projektu; null — bez przydziału.
  projectId: ProjectId | null;
  // NEED-01 (Z): energia w tysięcznych częściach (0–100 000 = 0–100).
  energy: number;
  // NEED-03 (Z): zadowolenie w 1/60 000 punktu — przy kroku 100 ms tempo 1 pkt / min to
  // dokładnie 100 jednostek na krok (bez dryfu zaokrągleń).
  satisfaction: number;
  // NEED-03: nieprzerwany czas złych warunków (ms czasu gry) — okres tolerancji.
  badConditionsMs: number;
  // NEED-05: nieprzerwany czas poniżej progu ostrzeżenia (ms czasu gry) — do odejścia.
  lowSatisfactionMs: number;
  // NEED-02, decyzja właściciela 2b: po rozkazie gracza automatyczne przerwy profilaktyczne
  // i obowiązkowe są wstrzymane — automat rusza dopiero przy progu wyczerpania. Kasowane, gdy
  // zacznie się kolejna przerwa (kawa/kanapa z rozkazu albo przerwa przy wyczerpaniu), oraz przy
  // wyjściu z biura (TIME-08). Rozkazy biurka i pola wstrzymanie zostawiają.
  breakHold: boolean;
  // NEED-02, decyzja właściciela 3c: kanapa z rozkazu trwa co najmniej minimalny czas
  // (`energy.minOrderedSofaSeconds`). Kasowane po zakończeniu tego odpoczynku i przy wyjściu.
  orderedRest: boolean;
};

export const ENERGY_SCALE = 1000;
export const MAX_ENERGY = 100 * ENERGY_SCALE;
export const SATISFACTION_SCALE = 60_000;
export const MAX_SATISFACTION = 100 * SATISFACTION_SCALE;

// EMP-08, NEED-05 (Z): odejście z firmy — zwolnienie przez gracza albo samodzielne.
export type Departure = {
  employeeId: EmployeeId;
  // Postać, która odeszła, nie wraca na rynek pracy.
  personId: PersonId;
  name: string;
  day: number;
  reason: 'fired' | 'quit';
};

export type WageTable = Readonly<Record<Seniority, number>>;

// EMP-03 (Z): rynek ma po jednym kandydacie na każdą parę specjalizacja × seniority, w stałej
// kolejności. Puste miejsca zajmuje losowa (z ziarnem — TIME-T04) osoba z listy postaci, która
// nie jest już wystawiona ani niedostępna (zatrudniona albo po odejściu z firmy — zwolnieni
// i ci, którzy odeszli sami, nie wracają). Miejsce zostaje puste, gdy pula pary się wyczerpie.
export function fillMarket(
  market: { candidates: readonly Candidate[]; ids: IdSequence; rng: RngState },
  unavailable: readonly { personId: PersonId }[],
  wages: WageTable,
): { candidates: Candidate[]; ids: IdSequence; rng: RngState } {
  const taken = new Set([...market.candidates, ...unavailable].map((p) => p.personId));
  const candidates: Candidate[] = [];
  let { ids, rng } = market;
  for (const specialization of SPECIALIZATIONS) {
    for (const seniority of SENIORITIES) {
      const offered = market.candidates.find(
        (c) => c.specialization === specialization && c.seniority === seniority,
      );
      if (offered) {
        candidates.push(offered);
        continue;
      }
      const pool = PEOPLE.filter(
        (p) => p.specialization === specialization && p.seniority === seniority && !taken.has(p.id),
      );
      if (pool.length === 0) continue;
      const roll = nextRandom(rng);
      const person = pick(pool, roll.value);
      const allocated = allocateId(ids, 'candidate');
      candidates.push({
        id: allocated.id,
        personId: person.id,
        name: person.name,
        specialization,
        seniority,
        dailyWage: wages[seniority],
      });
      ids = allocated.sequence;
      rng = roll.state;
    }
  }
  return { candidates, ids, rng };
}

function pick<T>(items: readonly T[], value: number): T {
  const item = items[Math.floor(value * items.length)];
  if (item === undefined) throw new Error('Pusta lista');
  return item;
}
