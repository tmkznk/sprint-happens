// Dane finansowe misji (FIN-01–08). Reguły operacji są w src/simulation/finance.ts.

export const OPERATION_KINDS = [
  // FIN-01: zaliczka przy przyjęciu kontraktu i reszta wynagrodzenia przy oddaniu.
  'advance',
  'payment',
  // FIN-02: obowiązkowe koszty rozliczane na koniec dnia.
  'wages',
  'upkeep',
  // FIN-02, OFF-06: zakup i sprzedaż wyposażenia.
  'purchase',
  'sale',
  // EVT-02: jawne skutki zdarzeń.
  'event',
] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

// Koszty obowiązkowe mogą sprowadzić saldo poniżej zera (FIN-08).
export const MANDATORY_COSTS: ReadonlySet<OperationKind> = new Set(['wages', 'upkeep', 'event']);

export type LedgerEntry = {
  // Klucz znaczeniowy operacji, np. `advance:contract-3`, `wages:day-5:employee-2`.
  // Unikalny w całej misji — chroni przed podwójną zaliczką, wypłatą lub rozliczeniem.
  key: string;
  day: number;
  kind: OperationKind;
  // Kwota ze znakiem: wpływ > 0, wydatek < 0. Liczba całkowita.
  amount: number;
  // Powiązana encja (kontrakt, pracownik, mebel, zdarzenie) albo null.
  ref: string | null;
};

export type Finance = {
  // Saldo otwarcia misji; saldo bieżące = otwarcie + suma księgi (sprawdzane przy wczytaniu).
  openingCash: number;
  cash: number;
  ledger: LedgerEntry[];
  // FIN-03, FIN-08: należności bieżącego dnia — dniówka każdej osoby zatrudnionej choć przez
  // część dnia, także zwolnionej. Rozliczenie dnia pobiera je i czyści (SH-029).
  wagesDueToday: Record<string, number>;
  // FIN-05 (decyzja SH-004 A1): po rozliczeniu z ujemnym saldem — dzień, którego rozliczenie
  // musi zakończyć się saldem ≥ 0, inaczej bankructwo. null — brak okresu ratunkowego.
  rescueDeadlineDay: number | null;
};
