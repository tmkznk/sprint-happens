import type { TechSpecialization } from '../contracts';

// Pula kontraktów (decyzja SH-032 A4, B8) — dane treściowe; liczby robocze do balansu w SH-044.
// Zakresy w punktach pracy (pp), wielokrotności fragmentu 10 pp. Design: znaczenie 0–5.
export type ContractTemplate = {
  id: string;
  // SH-032 A3b: poziom trudności odblokowywany liczbą oddanych projektów.
  level: 1 | 2 | 3;
  name: string;
  description: string;
  scopes: Partial<Record<TechSpecialization, number>>;
  designImportance: number;
  deadlineDays: number;
  reward: number;
};

// SH-032 A5: gwarantowany prosty kontrakt pierwszego dnia.
export const STARTER_CONTRACT_ID = 'turbo-zenek';

export const CONTRACT_TEMPLATES: readonly ContractTemplate[] = [
  {
    id: STARTER_CONTRACT_ID,
    level: 1,
    name: 'Strona-wizytówka dla mechanika „Turbo-Zenek”',
    description:
      'Zenek chce „coś jak u konkurencji, tylko lepiej”. Logo przyśle faksem. Godziny otwarcia: „jak przyjadę”.',
    scopes: { frontend: 60, backend: 40 },
    designImportance: 1,
    deadlineDays: 3,
    reward: 7_000,
  },
  {
    id: 'dog-blockchain',
    level: 1,
    name: 'Landing page startupu „AI na blockchainie dla psów”',
    description:
      'Inwestorzy przychodzą w czwartek. Produktu jeszcze nie ma, ale strona ma wyglądać, jakby był od dawna.',
    scopes: { frontend: 80 },
    designImportance: 4,
    deadlineDays: 3,
    reward: 7_500,
  },
  {
    id: 'contact-form',
    level: 1,
    name: 'Formularz kontaktowy, który „ma po prostu działać”',
    description:
      'Trzy pola, jeden przycisk i dwanaście integracji, o których klient przypomni sobie w trakcie.',
    scopes: { frontend: 40, backend: 60 },
    designImportance: 0,
    deadlineDays: 3,
    reward: 7_000,
  },
  {
    id: 'excel-invoices',
    level: 1,
    name: 'Skrypt do eksportu faktur z Excela',
    description:
      'Arkusz ma 40 zakładek, makra z 2009 roku i jedną komórkę, której nikt nie odważy się usunąć.',
    scopes: { backend: 90 },
    designImportance: 0,
    deadlineDays: 3,
    reward: 6_500,
  },
  {
    id: 'flower-shop',
    level: 2,
    name: 'Sklep internetowy kwiaciarni „Róża z Kodu”',
    description:
      'Walentynki za tydzień. Płatności, koszyk i wysyłka — najlepiej z dostawą „na wczoraj”.',
    scopes: { frontend: 150, backend: 150, devops: 50 },
    designImportance: 3,
    deadlineDays: 6,
    reward: 25_000,
  },
  {
    id: 'pierogi-app',
    level: 2,
    name: 'Aplikacja do zamawiania pierogów',
    description:
      'Babcia prowadzi biznes od 40 lat i chce wejść w mobile. Ruskie muszą być pierwsze na liście.',
    scopes: { mobile: 180, backend: 120, devops: 40 },
    designImportance: 2,
    deadlineDays: 7,
    reward: 26_000,
  },
  {
    id: 'cat-fitness',
    level: 2,
    name: 'Aplikacja fitness dla kotów',
    description:
      'Grupa docelowa nie ma kciuków ani motywacji. Za to właściciele mają karty kredytowe.',
    scopes: { mobile: 150, frontend: 50 },
    designImportance: 5,
    deadlineDays: 6,
    reward: 17_000,
  },
  {
    id: 'intranet-cloud',
    level: 2,
    name: 'Migracja intranetu z Excela do chmury',
    description:
      'Dział kadr korzysta z arkusza „FINAL_v7_naprawde_final.xlsx”. Chmura ma być „taka jak w Excelu”.',
    scopes: { backend: 200, devops: 100 },
    designImportance: 0,
    deadlineDays: 7,
    reward: 21_000,
  },
  {
    id: 'office-panel',
    level: 3,
    name: 'Panel urzędowy z 47 polami obowiązkowymi',
    description:
      'Każde pole wymaga pieczątki. Formularz musi działać w przeglądarce, której producent już nie istnieje.',
    scopes: { frontend: 250, backend: 250, devops: 60 },
    designImportance: 1,
    deadlineDays: 10,
    reward: 40_000,
  },
  {
    id: 'senior-courses',
    level: 3,
    name: 'Platforma kursów „Zostań seniorem w 3 tygodnie”',
    description:
      'Certyfikat w cenie, doświadczenie we własnym zakresie. Aplikacja mobilna, bo „wszyscy uczą się w tramwaju”.',
    scopes: { frontend: 200, backend: 200, mobile: 150, devops: 80 },
    designImportance: 4,
    deadlineDays: 12,
    reward: 52_000,
  },
  {
    id: 'banking-asap',
    level: 3,
    name: 'Superaplikacja bankowa „na wczoraj”',
    description:
      'Przelewy, kredyty, czat z doradcą i tryb ciemny. Zarząd widział podobną na konferencji.',
    scopes: { mobile: 250, backend: 300, devops: 120 },
    designImportance: 2,
    deadlineDays: 9,
    reward: 60_000,
  },
  {
    id: 'kebab-booking',
    level: 3,
    name: 'System rezerwacji dla sieci kebabów',
    description:
      'Rezerwacja stolika na 3:00 w nocy w sobotę musi działać zawsze. Sos czosnkowy jako osobna mikrousługa.',
    scopes: { frontend: 180, mobile: 180, backend: 220, devops: 80 },
    designImportance: 3,
    deadlineDays: 12,
    reward: 52_000,
  },
];
