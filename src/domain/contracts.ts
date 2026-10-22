import type { EntityId } from './ids';
import type { DeepReadonly } from './readonly';

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

// PROJ-09 (Z): postęp liczony wewnętrznie w punktach pracy; przechowywany w milionowych
// częściach punktu (liczby całkowite — deterministycznie, a mnożniki energii i premii PM-a
// nie gubią wydajności na zaokrągleniach: junior to 10 000 jednostek na krok).
export const POINT_SCALE = 1_000_000;

// BUG-01, BUG-06 (Z), decyzja SH-004 B1: ukończony fragment pracy technicznej. Fragmenty są
// dopisywane w kolejności ukończenia — to kolejka FIFO testów QA (SH-004 B2, SH-023).
// Błąd ma jeden poziom ważności i specjalizację fragmentu; przed testami jest ukryty (BUG-03).
export type Fragment = {
  specialization: TechSpecialization;
  hasBug: boolean;
  // BUG-05: postęp testów QA (milionowe pp, do rozmiaru fragmentu). Pełny test ujawnia błąd.
  testProgress: number;
  // BUG-06, SH-004 B3: postęp naprawy wykrytego błędu (milionowe pp). Zostaje przy błędzie,
  // więc przeżywa zmianę wykonawcy; pełny koszt oznacza błąd naprawiony.
  repairProgress: number;
};

export type Project = ContractTerms & {
  id: ProjectId;
  acceptedOnDay: number;
  // TIME-08 (Z): kontrakt przyjęty w dniu D na N dni ma termin na koniec dnia D+N.
  deadlineDay: number;
  status: ProjectStatus;
  // Wykonana praca każdej specjalizacji (milionowe pp); nigdy nie maleje (PROJ-09).
  progress: Partial<Record<TechSpecialization, number>>;
  fragments: Fragment[];
  // Ryzyko ważone pracą w bieżącym, nieukończonym fragmencie każdej specjalizacji
  // (Σ milionowe pp × ryzyko w promilach) — rozstrzygane przy ukończeniu fragmentu.
  fragmentRisk: Partial<Record<TechSpecialization, number>>;
  // PROJ-10 (Z): wykonana praca Designera (milionowe pp), do `designScope`; nie generuje błędów.
  designProgress: number;
  // PROJ-07, BUG-04 (Z): raport rozliczenia oddania; null, dopóki projekt jest aktywny.
  delivery: DeliveryReport | null;
};

// PROJ-07, FIN-04, BUG-04, REP-04 (Z): raport rozdziela terminowość, jakość techniczną, design
// i pieniądze. Kwoty w jednostkach waluty, jakość i design w promilach.
export type DeliveryReport = {
  day: number;
  daysLate: number;
  penalty: number;
  payment: number;
  remainingBugs: number;
  qualityPermille: number;
  designPermille: number;
  reputation: { punctuality: number; quality: number; design: number; total: number };
  reputationAfter: number;
};

export type ReadonlyProject = DeepReadonly<Project>;
