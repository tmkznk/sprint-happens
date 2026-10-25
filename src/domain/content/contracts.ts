import type { TechSpecialization } from '../contracts';

// Katalog zleceń (wersja robocza 1.0, 24.10.2026; bez „Koszyka pełnego nadziei”, nowy opis
// zlecenia startowego) — dane treściowe; liczby to propozycja do balansu
// (SH-044). Zakresy i design w punktach katalogu: silnik mnoży je przez
// `contracts.pointsPerCatalogPoint` z konfiguracji, więc tabela zgadza się 1:1 z katalogiem.
// Katalog nie zna QA ani PM-a (role opcjonalne — PROJ-03); „Grafik” to opcjonalny design (PROJ-10).
export type ContractTemplate = {
  id: string;
  // SH-032 A3b: poziom trudności odblokowywany liczbą oddanych projektów.
  level: 1 | 2 | 3;
  name: string;
  description: string;
  scopes: Partial<Record<TechSpecialization, number>>;
  // Punkty pracy Designera (0 — projekt bez designu).
  design: number;
  deadlineDays: number;
  reward: number;
  // FIN-01: zaliczka (część wynagrodzenia) przy przyjęciu.
  advance: number;
  // FIN-04: kara za każdy dzień opóźnienia, do wysokości reszty wypłaty.
  latePenaltyPerDay: number;
};

// SH-032 A5: gwarantowany kontrakt pierwszego dnia — luźny termin, wysoka zaliczka, niska kara.
export const STARTER_CONTRACT_ID = 'podejrzanie-dobry-klient';

export const CONTRACT_TEMPLATES: readonly ContractTemplate[] = [
  {
    id: 'mala-stronka',
    level: 1,
    name: 'Tylko mała stronka',
    description:
      'Pięć zakładek, formularz i galeria. Do tego sklep, system rezerwacji i panel dla franczyzobiorców. Klient nadal mówi o tym „wizytówka”.',
    scopes: { frontend: 35, backend: 25, devops: 5 },
    design: 15,
    deadlineDays: 8,
    reward: 18_000,
    advance: 5_400,
    latePenaltyPerDay: 450,
  },
  {
    id: 'uber-dla-koparek',
    level: 3,
    name: 'Uber dla koparek',
    description:
      'Rewolucyjna aplikacja łącząca ludzi, którzy mają koparkę, z ludźmi, którzy właśnie potrzebują dziury. Założyciel ma już logo i bluzę z logo. Szuka kogoś, kto zrobi resztę.',
    scopes: { frontend: 15, backend: 65, mobile: 70, devops: 15 },
    design: 25,
    deadlineDays: 15,
    reward: 52_000,
    advance: 10_400,
    latePenaltyPerDay: 1_200,
  },
  {
    id: 'bozena-db',
    level: 2,
    name: 'BożenaDB',
    description:
      'Od osiemnastu lat cała firma działa na jednym Excelu. Nikt nie wie, co robi kolumna AF, ale po jej usunięciu magazyn przestaje wydawać towar. Pani Bożena zgodziła się na cyfryzację pod warunkiem, że wszystko zostanie w Excelu.',
    scopes: { frontend: 20, backend: 60, devops: 10 },
    design: 5,
    deadlineDays: 10,
    reward: 26_000,
    advance: 10_400,
    latePenaltyPerDay: 500,
  },
  {
    id: 'u-mnie-dziala',
    level: 2,
    name: 'U mnie działa',
    description:
      'Aplikacja działa wyłącznie na laptopie poprzedniego programisty. Laptop leży w sali konferencyjnej i nie wolno go zamykać. Celem projektu jest umożliwienie firmie ponownego korzystania z sali konferencyjnej.',
    scopes: { frontend: 5, backend: 20, devops: 35 },
    design: 0,
    deadlineDays: 4,
    reward: 21_000,
    advance: 10_500,
    latePenaltyPerDay: 1_000,
  },
  {
    id: 'minimum-viable-palac',
    level: 3,
    name: 'MVP: Minimum Viable Pałac',
    description:
      'Klient chce najprostszą możliwą wersję produktu. Przesłał listę 146 niezbędnych funkcji, w tym program lojalnościowy, rozpoznawanie twarzy i obsługę lodówek. Wszystkie oznaczył jako „na start”.',
    scopes: { frontend: 70, backend: 100, mobile: 65, devops: 30 },
    design: 35,
    deadlineDays: 20,
    reward: 78_000,
    advance: 19_500,
    latePenaltyPerDay: 1_800,
  },
  {
    id: 'legacy-of-the-ancients',
    level: 2,
    name: 'Legacy of the Ancients',
    description:
      'System napisał człowiek, którego nazwisko wymawia się w firmie szeptem. Dokumentacja odsyła do forum, które już nie istnieje. W kodzie znaleziono komentarz „tymczasowo”, datowany na 2006 rok.',
    scopes: { frontend: 30, backend: 85, devops: 25 },
    design: 0,
    deadlineDays: 12,
    reward: 42_000,
    advance: 16_800,
    latePenaltyPerDay: 900,
  },
  {
    id: 'synergia360',
    level: 3,
    name: 'Synergia360',
    description:
      'Platforma do usprawniania komunikacji między działami. Każdy dział podał inne wymagania i poprosił, żeby nie konsultować ich z pozostałymi. Spotkanie otwierające odbędzie się osobno dla każdej ze stron.',
    scopes: { frontend: 55, backend: 60, devops: 15 },
    design: 20,
    deadlineDays: 14,
    reward: 39_000,
    advance: 11_700,
    latePenaltyPerDay: 700,
  },
  {
    id: 'andrzej-inaczej',
    level: 2,
    name: 'AI, czyli Andrzej Inaczej',
    description:
      'Firma chce zastąpić obsługę klienta sztuczną inteligencją. Na razie na pytania odpowiada Andrzej, podpisując się „Asystent AI”. Projekt ma zautomatyzować Andrzeja, zanim pójdzie na urlop.',
    scopes: { frontend: 20, backend: 65, devops: 20 },
    design: 10,
    deadlineDays: 9,
    reward: 36_000,
    advance: 14_400,
    latePenaltyPerDay: 1_000,
  },
  {
    id: 'piksel-w-lewo',
    level: 1,
    name: 'Piksel w lewo',
    description:
      'Odświeżenie strony dla klienta z wyczuciem estetyki. Wie dokładnie, czego chce, ale potrafi to opisać dopiero po zobaczeniu czegoś innego. Obecnie poszukuje koloru „bardziej wow, tylko spokojniejszego”.',
    scopes: { frontend: 20 },
    design: 45,
    deadlineDays: 7,
    reward: 14_000,
    advance: 7_000,
    latePenaltyPerDay: 250,
  },
  {
    id: 'deploy-przed-grillem',
    level: 2,
    name: 'Deploy przed grillem',
    description:
      'Niewielka aktualizacja, którą trzeba wdrożyć w piątek po południu. Klient zapewnia, że w weekend nikt nie korzysta z systemu. System obsługuje rezerwacje domków letniskowych.',
    scopes: { frontend: 5, backend: 10, devops: 20 },
    design: 0,
    deadlineDays: 2,
    reward: 14_000,
    advance: 7_000,
    latePenaltyPerDay: 1_400,
  },
  {
    id: 'chmura-nad-firma',
    level: 2,
    name: 'Chmura nad firmą',
    description:
      'Zarząd zdecydował, że wszystko ma być w chmurze. Jakiej — jeszcze nie ustalono, ale prezentacja zawierała bardzo przekonujące zdjęcie nieba. Lokalny serwer już wystawiono na sprzedaż.',
    scopes: { backend: 25, devops: 65 },
    design: 0,
    deadlineDays: 8,
    reward: 29_000,
    advance: 11_600,
    latePenaltyPerDay: 800,
  },
  {
    id: 'kliknij-zeby-pracowac',
    level: 1,
    name: 'Kliknij, żeby pracować',
    description:
      'System do mierzenia produktywności pracowników. Co piętnaście minut trzeba w nim zaznaczyć, czym się człowiek zajmował. Najczęściej wybieraną odpowiedzią w prototypie jest „uzupełnianie systemu”.',
    scopes: { frontend: 35, backend: 30, devops: 5 },
    design: 10,
    deadlineDays: 8,
    reward: 20_000,
    advance: 4_000,
    latePenaltyPerDay: 400,
  },
  {
    id: 'portal-bez-barier',
    level: 3,
    name: 'Portal bez barier*',
    description:
      'Nowoczesny portal, dostępny dla każdego obywatela. Wymaga konkretnej wersji przeglądarki, wtyczki sprzed dekady i certyfikatu wydawanego w pokoju 214. Pokój 214 jest czynny we wtorki.',
    scopes: { frontend: 65, backend: 70, devops: 20 },
    design: 25,
    deadlineDays: 18,
    reward: 48_000,
    advance: 4_800,
    latePenaltyPerDay: 1_200,
  },
  {
    id: 'tinder-dla-golebi',
    level: 2,
    name: 'Tinder dla gołębi',
    description:
      'Aplikacja dla hodowców poszukujących idealnej pary dla swoich podopiecznych. Przesunięcie w prawo oznacza zainteresowanie, w lewo — rosół. Klient podkreśla, że ten drugi komunikat jest jeszcze do konsultacji.',
    scopes: { backend: 35, mobile: 60, devops: 10 },
    design: 25,
    deadlineDays: 12,
    reward: 34_000,
    advance: 10_200,
    latePenaltyPerDay: 650,
  },
  {
    id: 'zgodnie-z-zalacznikiem',
    level: 1,
    name: 'Zgodnie z załącznikiem',
    description:
      'Projekt opisano szczegółowo w załączniku do wiadomości. Załącznika nie ma. Klient pyta, czy możemy już podać termin realizacji.',
    scopes: { frontend: 15, backend: 15, devops: 5 },
    design: 5,
    deadlineDays: 5,
    reward: 9_000,
    advance: 1_800,
    latePenaltyPerDay: 200,
  },
  {
    id: 'final-final-ostateczny',
    level: 2,
    name: 'Final_final_OSTATECZNY',
    description:
      'Agencja potrzebuje systemu do zarządzania wersjami plików. Aktualnie obowiązująca wersja projektu nazywa się „nowy_final2_poprawiony_TO_TEN”. Nikt jej nie używa, bo na pulpicie jest nowsza.',
    scopes: { frontend: 30, backend: 40, devops: 15 },
    design: 10,
    deadlineDays: 10,
    reward: 25_000,
    advance: 7_500,
    latePenaltyPerDay: 500,
  },
  {
    id: 'zmien-tylko-logo',
    level: 2,
    name: 'Zmień tylko logo',
    description:
      'Klient kupił konkurencyjną firmę i chce podmienić jej logo w aplikacji. Przy okazji trzeba połączyć bazy danych, płatności i konta użytkowników z siedmiu krajów. Budżet zatwierdzono na podmianę logo.',
    scopes: { frontend: 20, backend: 65, mobile: 15, devops: 20 },
    design: 5,
    deadlineDays: 10,
    reward: 24_000,
    advance: 4_800,
    latePenaltyPerDay: 600,
  },
  {
    id: 'spotkanie-moglo-byc-aplikacja',
    level: 2,
    name: 'Spotkanie mogło być aplikacją',
    description:
      'Platforma do organizacji spotkań, na których ustala się terminy kolejnych spotkań. Klient chce skrócić ten proces do trzech spotkań. Warsztat ustalający zakres potrwa dwa dni.',
    scopes: { frontend: 25, backend: 25, mobile: 25, devops: 5 },
    design: 10,
    deadlineDays: 10,
    reward: 23_000,
    advance: 6_900,
    latePenaltyPerDay: 400,
  },
  {
    id: STARTER_CONTRACT_ID,
    level: 1,
    name: 'Podejrzanie dobry klient',
    description:
      'Strona z rezerwacjami dla zakładu pogrzebowego. Wymagania spisane, makiety gotowe, budżet z zapasem. Jedyna uwaga klienta: „Bez pośpiechu, nasi klienci nigdzie się nie wybierają”.',
    scopes: { frontend: 25, backend: 25, devops: 5 },
    design: 15,
    deadlineDays: 10,
    reward: 21_000,
    advance: 10_500,
    latePenaltyPerDay: 200,
  },
];
