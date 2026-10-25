import type { Seniority, Specialization } from '../employees';

// Żartobliwe opisy kandydatów i pracowników — wyłącznie kosmetyczne, bez wpływu na reguły.
// Imiona i nazwiska losują się niezależnie, więc teksty są neutralne płciowo (czas teraźniejszy,
// bez form „zrobił/zrobiła”). Po kilka wariantów na specjalizację i poziom.
export const BIOS: Readonly<
  Record<Specialization, Readonly<Record<Seniority, readonly string[]>>>
> = {
  frontend: {
    junior: [
      'Wycentruje każdy div — przy trzeciej próbie i z tutorialem z 2016 roku. Ulubiony framework? Ten, który wyszedł wczoraj.',
      'Ma w zakładkach 214 artykułów o CSS. Przeczytanie ich planuje na sprint, który nigdy nie nadejdzie.',
    ],
    mid: [
      'Kiedy mówi „to kwestia dwóch pikseli”, zespół rezerwuje resztę sprintu. Ma osobną zakładkę przeglądarki na każdą emocję.',
      'Rozróżnia dziewięć odcieni „prawie działa w Safari”. Folder node_modules traktuje jak zjawisko pogodowe — nie walczy, przeczekuje.',
    ],
    senior: [
      'Pamięta czasy, gdy stronę dało się zrobić bez tysiąca paczek. Na pytanie „czy da się szybciej?” odpowiada bardzo wolnym spojrzeniem.',
      'Ma za sobą trzy wojny o średniki i żadnej nie przegrywa. Code review zaczyna od westchnienia, a kończy na „ogólnie spoko”.',
    ],
  },
  backend: {
    junior: [
      'Pierwszy endpoint robi do sprawdzania, czy kawa jest już gotowa. Drugi — do sprawdzania, czy działa pierwszy.',
      'Uważa, że SELECT * to nie problem, tylko styl życia. Logi czyta jak horoskop: szuka w nich czegoś o sobie.',
    ],
    mid: [
      'Lubi czystą architekturę i brudne kubki. Bałagan na biurku nazywa systemem rozproszonym.',
      'Nazywa zmienne tak dokładnie, że dokumentacja czuje się zbędna. Na każde pytanie odpowiada „to zależy” — i rysuje diagram.',
    ],
    senior: [
      'Słyszy wolne zapytania przez ścianę. Po ostatniej optymalizacji bazy klient pyta, gdzie podziała się połowa danych.',
      'Nosi w głowie mapę wszystkich mikroserwisów i nikomu jej nie pokazuje — dla dobra psychicznego zespołu.',
    ],
  },
  mobile: {
    junior: [
      'Testuje aplikację na telefonie z pękniętym ekranem, bo „to prawdziwe warunki użytkownika”. Emulatorów ma więcej niż wolnych gniazdek.',
      'Wierzy, że recenzja w sklepie z aplikacjami potrwa jeden dzień. Zespół nie ma serca wyprowadzać z błędu.',
    ],
    mid: [
      'Zna trzy sposoby na obejście ograniczeń systemu. Czwarty to wpis w release notes, że to zamierzone zachowanie.',
      'Każdą rozmowę zaczyna od „a na Androidzie…”. Ładowarki nosi przy sobie tak, jak inni chusteczki.',
    ],
    senior: [
      'Aplikacje tej osoby działają nawet na telefonach z szuflady z kablami. Słowo „responsywny” stosuje też wobec ekspresu.',
      'Pamięta każdą odrzuconą aktualizację i powód odrzucenia — z datą. Tryb ciemny włącza wszędzie, gdzie się da.',
    ],
  },
  devops: {
    junior: [
      'Ma dostęp do produkcji od wczoraj, a pokorę od dzisiaj rana. Wcięcia w YAML-u mierzy linijką.',
      'Na każdy problem ma jedno rozwiązanie: wyłączyć i włączyć. Działa częściej, niż seniorzy chcieliby przyznać.',
    ],
    mid: [
      'Automatyzuje wszystko, co musi zrobić drugi raz. Przy trzecim razie automatyzuje tłumaczenie, dlaczego automatyzacja nie zadziałała.',
      'Ma plan awaryjny do planu awaryjnego. Za najstabilniejsze środowisko uważa kanapę po pracy.',
    ],
    senior: [
      'Nie wierzy w pecha, wierzy w brak monitoringu. W piątki po piętnastej nie wyłącza serwerów, tylko możliwość negocjacji.',
      'Uptime liczy z dokładnością do sekundy, urlop — z dokładnością do incydentu. Do telefonu dyżurnego mówi po imieniu.',
    ],
  },
  qa: {
    junior: [
      'Kliknie tam, gdzie nikt rozsądny nie kliknąłby nawet przypadkiem. Nazywa to empatią wobec użytkownika.',
      'Zgłasza błędy z taką radością, że developerzy podejrzewają premię od sztuki. Premii nie ma — jest pasja.',
    ],
    mid: [
      'Potrafi zepsuć kalkulator, wpisując do niego imię kota. Gdy mówi „mam tylko jedną uwagę”, developerzy zapisują wszystkie pliki.',
      'Nie wypomina — po prostu wkleja numer zgłoszenia sprzed miesiąca. Ulubiony happy path prowadzi prosto do błędu krytycznego.',
    ],
    senior: [
      'Wie, gdzie siedzi błąd, zanim powstanie kod. Testy regresji odpala z takim spokojem, jakby to była medytacja.',
      'Pamięta każdy błąd, który „już nigdy nie wróci”. Prowadzi ich listę. Lista jest długa.',
    ],
  },
  designer: {
    junior: [
      'Rozpoznaje font po literze „a”. Na spotkaniach zwraca uwagę głównie na odstępy między wypowiedziami.',
      'Ma moodboard na każdą okazję, w tym na moodboardy. Słowo „minimalizm” wypowiada z trzema wykrzyknikami.',
    ],
    mid: [
      'Ma siedem odcieni bieli i konkretne zdanie o każdym. Słowo „ładniej” traktuje jak zgłoszenie bez kryteriów akceptacji.',
      'Warstwy w Figmie nazywa staranniej niż developerzy zmienne. Uwagi do makiet zostawia w kolorze pasującym do tła.',
    ],
    senior: [
      'Potrafi usunąć połowę przycisków i przekonać klienta, że dostał więcej. Na „zróbmy logo większe” ma gotową prezentację.',
      'Jednym spojrzeniem rozpoznaje, który przycisk dodał klient. Zwykle ten najbardziej czerwony.',
    ],
  },
  pm: {
    junior: [
      'Ma arkusz do śledzenia arkuszy, ale nie przyznaje się do tego na retrospektywie. Każde spotkanie kończy pytaniem o kolejne.',
      'Wciąż wierzy w estymaty. Zespół trzyma kciuki i nie pokazuje tej osobie historii zadań.',
    ],
    mid: [
      'Tłumaczy „to niemożliwe” na „wymaga zmiany zakresu”. Kalendarz koloruje tak starannie, że spotkania wyglądają na przyjemne.',
      '„Szybki sync” w tym wykonaniu naprawdę bywa szybki — zespół wciąż to bada. Przy mailach od klienta ćwiczy oddychanie przeponą.',
    ],
    senior: [
      'Potrafi zamknąć spotkanie, zanim ktoś zaproponuje kolejne. Terminy zapisuje ołówkiem, ustalenia z klientem — w trzech kopiach.',
      'Na „to mała zmiana” reaguje tylko uniesieniem brwi. Klienci po tym sami zmniejszają zakres.',
    ],
  },
};

// Opis wynika z imienia, specjalizacji i poziomu (stały skrót tekstu), więc nie zajmuje miejsca
// w zapisie, nie zużywa generatora losowego i nie zmienia się po zatrudnieniu kandydata.
export function bioFor(person: {
  name: string;
  specialization: Specialization;
  seniority: Seniority;
}): string {
  const variants = BIOS[person.specialization][person.seniority];
  let hash = 0;
  for (const char of person.name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return variants[hash % variants.length] ?? '';
}
