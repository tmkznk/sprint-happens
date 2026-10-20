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
  name: string;
  specialization: Specialization;
  seniority: Seniority;
  // EMP-03: gracz widzi pensję dzienną przed zatrudnieniem.
  dailyWage: number;
};

export type Employee = {
  id: EmployeeId;
  name: string;
  specialization: Specialization;
  seniority: Seniority;
  dailyWage: number;
  hiredOnDay: number;
  // OFF-04 (Z): jedno biurko na osobę; null — zatrudniony bez stanowiska (EMP-04).
  deskId: FurnitureId | null;
  // EMP-05 (Z): jeden aktywny przydział do projektu; null — bez przydziału.
  projectId: ProjectId | null;
};

// Imiona i nazwiska kandydatów — neutralne, wyłącznie kosmetyczne.
export const FIRST_NAMES = [
  'Ada',
  'Bartek',
  'Celina',
  'Damian',
  'Ewa',
  'Filip',
  'Gosia',
  'Hubert',
  'Iga',
  'Jacek',
  'Kasia',
  'Leon',
  'Marta',
  'Nikodem',
  'Ola',
  'Piotr',
  'Renata',
  'Szymon',
  'Tamara',
  'Wiktor',
  'Zuza',
] as const;

export const LAST_NAMES = [
  'Bugajska',
  'Commitowski',
  'Deployer',
  'Fiksiński',
  'Gitowska',
  'Hotfixowski',
  'Kodowska',
  'Lintowski',
  'Mergowska',
  'Pushowski',
  'Refaktor',
  'Sprintowska',
  'Stackowski',
  'Tasiemiec',
  'Ticketowska',
] as const;

export type WageTable = Readonly<Record<Seniority, number>>;

// EMP-03 (Z): nowy kandydat danej specjalizacji i seniority. Imię losuje generator z ziarnem,
// więc rynek jest deterministyczny i odtwarzalny z zapisu (TIME-T04).
export function generateCandidate(
  ids: IdSequence,
  rng: RngState,
  specialization: Specialization,
  seniority: Seniority,
  wages: WageTable,
): { candidate: Candidate; ids: IdSequence; rng: RngState } {
  const allocated = allocateId(ids, 'candidate');
  const first = nextRandom(rng);
  const last = nextRandom(first.state);
  const name = `${pick(FIRST_NAMES, first.value)} ${pick(LAST_NAMES, last.value)}`;
  return {
    candidate: { id: allocated.id, name, specialization, seniority, dailyWage: wages[seniority] },
    ids: allocated.sequence,
    rng: last.state,
  };
}

// Rynek startowy: po jednym kandydacie dla każdej pary specjalizacja × seniority (EMP-03).
export function generateMarket(
  ids: IdSequence,
  rng: RngState,
  wages: WageTable,
): { candidates: Candidate[]; ids: IdSequence; rng: RngState } {
  const candidates: Candidate[] = [];
  let state = { ids, rng };
  for (const specialization of SPECIALIZATIONS) {
    for (const seniority of SENIORITIES) {
      const next = generateCandidate(state.ids, state.rng, specialization, seniority, wages);
      candidates.push(next.candidate);
      state = next;
    }
  }
  return { candidates, ...state };
}

function pick<T>(items: readonly T[], value: number): T {
  const item = items[Math.floor(value * items.length)];
  if (item === undefined) throw new Error('Pusta lista');
  return item;
}
