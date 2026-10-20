import type { EntityId } from './ids';

// PROJ-01, PROJ-02 (Z): zakresy pracy mają tylko specjalizacje techniczne; QA, Designer i PM
// są opcjonalni (PROJ-03).
export const TECH_SPECIALIZATIONS = ['frontend', 'backend', 'mobile', 'devops'] as const;
export type TechSpecialization = (typeof TECH_SPECIALIZATIONS)[number];

export type OfferId = EntityId<'offer'>;
export type ProjectId = EntityId<'project'>;

// CON-02 (Z): warunki widoczne przed przyjęciem. Wartości zapisane w ofercie — zmiana balansu
// nie zmienia warunków już wystawionych ofert ani przyjętych kontraktów.
export type ContractTerms = {
  templateId: string;
  name: string;
  description: string;
  scopes: Partial<Record<TechSpecialization, number>>;
  designImportance: number;
  // PROJ-10, decyzja SH-032 B6: zakres designu w pp (20 pp × znaczenie).
  designScope: number;
  deadlineDays: number;
  reward: number;
  // FIN-01, decyzja SH-032 B5: zaliczka 30% wynagrodzenia.
  advance: number;
  // FIN-04, decyzja SH-032 B5: kara za każdy rozpoczęty dzień opóźnienia (10% wynagrodzenia).
  latePenaltyPerDay: number;
};

export type Offer = ContractTerms & { id: OfferId };

export type ProjectStatus = 'active' | 'delivered';

// PROJ-09 (Z): postęp liczony wewnętrznie w punktach pracy; przechowywany w tysięcznych
// częściach punktu (liczby całkowite — deterministycznie i bez błędów zaokrągleń).
export const MILLI_POINTS = 1000;

export type Project = ContractTerms & {
  id: ProjectId;
  acceptedOnDay: number;
  // TIME-08 (Z): kontrakt przyjęty w dniu D na N dni ma termin na koniec dnia D+N.
  deadlineDay: number;
  status: ProjectStatus;
  // Wykonana praca każdej specjalizacji (tysięczne pp); nigdy nie maleje (PROJ-09).
  progress: Partial<Record<TechSpecialization, number>>;
};
