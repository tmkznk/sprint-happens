// Zakładka „Zasady gry”: FAQ dla gracza — obrazowo, z humorem, bez liczb balansu (te mogą się
// zmieniać). Treść musi zgadzać się z regułami silnika (src/simulation) — przy zmianie mechaniki
// popraw też tutaj.

export type RulesQuestion = { question: string; answer: string[] };
export type RulesSection = { title: string; questions: RulesQuestion[] };

export const RULES_INTRO =
  'Krótki przewodnik po tym, jak naprawdę działa Twój software house. Bez tabelek w Excelu ' +
  'i bez prezentacji na 40 slajdów — same zasady, które przydają się, gdy termin płonie, ' +
  'a ekspres właśnie odmówił współpracy.';

export const RULES: RulesSection[] = [
  {
    title: 'Praca nad projektem',
    questions: [
      {
        question: 'Kto robi co w projekcie?',
        answer: [
          'Projekt składa się z części technicznych — frontendu, backendu, aplikacji mobilnej czy wdrożenia. Każdą robi developer tej specjalizacji. Wszystkie części idą równolegle: backendowiec nie czeka na frontendowca (i vice versa, choć obaj chętnie by na siebie ponarzekali).',
          'Do tego dochodzą role wspierające: QA szuka dziury w całym, Designer dba, żeby całość nie wyglądała jak panel admina z 2004 roku, a PM pilnuje, żeby wszystko szło sprawniej.',
        ],
      },
      {
        question: 'Czy więcej developerów to szybciej?',
        answer: [
          'Tak. Dwóch frontendowców w jednym projekcie skończy frontend mniej więcej dwa razy szybciej — ich praca po prostu się sumuje. W tym biurze nie działa klątwa „dziewięć kobiet nie urodzi dziecka w miesiąc”. Fred Brooks byłby w szoku.',
          'Pamiętaj tylko, że przyspieszasz wyłącznie ich część. Projekt jest gotowy dopiero, gdy skończone są wszystkie części techniczne — najwolniejsza z nich wyznacza tempo. A każda dodatkowa osoba to dodatkowa pensja, której klient nie zauważy, ale Twoje konto — owszem.',
        ],
      },
      {
        question: 'Junior, mid, senior — co za różnica?',
        answer: [
          'Senior pracuje szybciej i myli się znacznie rzadziej. Junior jest tańszy, pełen entuzjazmu i równie pełen błędów. Mid jest pośrodku — już wie, że nic nie wie, ale jeszcze się tym nie przejmuje.',
          'Gdy nad jedną częścią pracuje kilka osób, jakość zależy od tego, kto ile napisał — senior z juniorem dają wynik pośredni. Code review niestety nie wliczono w budżet.',
        ],
      },
      {
        question: 'Po co mi PM?',
        answer: [
          'PM nie pisze kodu, ale przyspiesza cały zespół swojego projektu — developerów, testerów i naprawy błędów. Jak? Nikt do końca nie wie, ale działa. Im bardziej doświadczony PM, tym większy zastrzyk tempa.',
          'Pracuje tylko przy swoim biurku, więc też się męczy i potrzebuje przerw. Excel sam się nie wypełni.',
        ],
      },
      {
        question: 'A Designer?',
        answer: [
          'Designer pracuje obok techniki, nad wyglądem projektu. Nie jest wymagany do oddania, ale dobry design to dodatkowa reputacja — tym większa, im bardziej klientowi zależy, żeby „było ładnie, ale bez przesady, i może jednak trochę bardziej niebiesko”.',
          'Częściowy design daje część premii, a brak designu nie jest karany. Klient po prostu dostanie Times New Roman.',
        ],
      },
      {
        question: 'Kiedy ktoś w ogóle pracuje?',
        answer: [
          'Tylko przy własnym biurku, przydzielony do projektu, w godzinach pracy i nie w trakcie przerwy. Osoba bez biurka nie pracuje wcale — laptop na kolanach w kuchni to nie jest stanowisko pracy. Kup biurko i je przydziel.',
        ],
      },
    ],
  },
  {
    title: 'Błędy i testy',
    questions: [
      {
        question: 'Skąd się biorą błędy?',
        answer: [
          'Z pisania kodu. Każdy kawałek nowej pracy może zawierać błąd — junior wpuszcza ich więcej niż senior, a zmęczony więcej niż wypoczęty. Kod pisany o 16:55 w piątek ma swoją legendę.',
          'Błędy są niewidoczne. Dopóki nikt ich nie znajdzie, nie wiesz, ile ich jest. „U mnie działa” to nie jest raport z testów.',
        ],
      },
      {
        question: 'Co robi QA?',
        answer: [
          'QA testuje już napisaną pracę, kawałek po kawałku, i wykrywa ukryte w niej błędy. Tester nie wie, gdzie są błędy, więc sprawdza wszystko — także to, co okaże się bezbłędne. Taki zawód: wiecznie podejrzliwy.',
          'QA błędów nie naprawia. Wykryty błąd ląduje z powrotem u developerów, z krótką notatką „nie działa”.',
          'W projekcie widzisz pokrycie testami i liczbę wykrytych błędów. Niskie pokrycie oznacza, że w kodzie może czaić się więcej niespodzianek — a klient uwielbia niespodzianki. Wcale nie.',
        ],
      },
      {
        question: 'Kto naprawia błędy?',
        answer: [
          'Developer tej specjalizacji, w której błąd powstał: błąd frontendu naprawi tylko frontendowiec, błąd backendu — tylko backendowiec. Backendowiec nie dotknie CSS-a, nawet za podwyżkę. Nie musi to jednak być autor błędu — wystarczy ktoś z tej roli w projekcie.',
          'Developer najpierw kończy swoją część, a dopiero potem bierze się za naprawy. Naprawa jest szybka, nie tworzy nowych błędów i nie wymaga ponownego testu. Tak, w tym biurze poprawki naprawdę niczego nie psują. To gra.',
          'Kilku developerów tej samej roli naprawia różne błędy jednocześnie.',
        ],
      },
      {
        question: 'Co jeśli zabiorę z projektu jedynego frontendowca?',
        answer: [
          'Wtedy nikt nie naprawi błędów frontendu — QA może je dalej wykrywać, ale będą wisieć jak stare tickety w backlogu. Jeśli frontend nie był skończony, stanie też jego dalsza budowa.',
          'Bezpiecznie jest przenieść kogoś, gdy jego część jest skończona, przetestowana, a wykryte błędy naprawione.',
        ],
      },
    ],
  },
  {
    title: 'Oddanie projektu',
    questions: [
      {
        question: 'Kiedy mogę oddać projekt?',
        answer: [
          'Gdy skończone są wszystkie części techniczne. Testy, design i naprawy nie są wymagane — możesz wypuścić to „na produkcję i zobaczymy”. Ocena klienta pokaże, jak to wyszło.',
        ],
      },
      {
        question: 'Jak klient ocenia projekt?',
        answer: [
          'Liczą się terminowość, jakość techniczna i design. Za oddanie w terminie jest premia do reputacji, za każdy dzień spóźnienia — kara i mniejsza wypłata. „Prawie skończone” to nie jest status.',
          'Jakość zależy od wszystkich nienaprawionych błędów — także tych, których QA nie zdążyło znaleźć. Klient je znajdzie. Zawsze znajduje, najlepiej w piątek wieczorem. Większy projekt zniesie więcej błędów niż mały.',
          'Błędy nie zmniejszają wypłaty, ale potrafią mocno uderzyć w reputację. Pełną ocenę zobaczysz w raporcie po oddaniu.',
        ],
      },
    ],
  },
  {
    title: 'Energia i przerwy',
    questions: [
      {
        question: 'Jak zmęczenie wpływa na pracę?',
        answer: [
          'Energia spada podczas pracy. Zmęczona osoba pracuje wolniej i robi więcej błędów, a bez energii nie robi nic — patrzy w monitor i zastanawia się nad sensem życia.',
          'Chodzenie, czekanie czy brak zadań nie męczą — męczy tylko praca. Jak w życiu.',
        ],
      },
      {
        question: 'Kawa czy kanapa?',
        answer: [
          'Ludzie sami robią sobie przerwy, gdy czują zmęczenie. Kawa to szybki zastrzyk energii, kanapa — dłuższy, porządny odpoczynek dla naprawdę wykończonych.',
          'Za mało ekspresów i kanap oznacza kolejki, a czas w kolejce to czas bez pracy. Kolejka do ekspresu to też najlepsze miejsce na plotki, ale tego akurat gra nie liczy. Przy większym zespole dokup miejsca odpoczynku.',
          'Niektórzy wychodzą też na papierosa na taras — to przerwa, która energii nie dodaje, ale bez niej się nie da.',
        ],
      },
      {
        question: 'Czy mogę sam wysłać kogoś na przerwę?',
        answer: [
          'Tak. Zaznacz postać w biurze i wyślij ją do ekspresu, na kanapę, do biurka albo na wybrane miejsce. Odpoczynek na kanapie z Twojego polecenia trwa przynajmniej chwilę, nawet gdy ktoś twierdzi, że „już jest okej”.',
          'Po kawie czy kanapie z Twojego polecenia pracownik sam wraca do biurka i dalej chodzi na przerwy jak zwykle.',
        ],
      },
      {
        question: 'Termin goni! Mogę przycisnąć pracownika?',
        answer: [
          'Możesz. Odeślij go do biurka (albo w wybrane miejsce) — od tej chwili nie pójdzie sam na kawę, dopóki dosłownie nie padnie ze zmęczenia albo nie skończy się dzień. Klasyczny crunch: „jeszcze tylko ten jeden ficzer i wdrażamy”.',
          'Działa, ale ma swoją cenę. Zmęczony pracuje coraz wolniej, sieje błędami jak junior po trzech energetykach i powoli traci humor. Przyciśnij, dowieź, a potem wyślij biedaka na kanapę — należy mu się.',
        ],
      },
    ],
  },
  {
    title: 'Zadowolenie zespołu',
    questions: [
      {
        question: 'Co psuje humor pracownikom?',
        answer: [
          'Brak własnego biurka, czekanie na wolne miejsce odpoczynku i praca na oparach energii. Chwilę wytrzymają, ale dłuższe złe warunki powoli obniżają zadowolenie.',
          'Brak przydziału do projektu nikomu nie przeszkadza — płatne siedzenie bez zadań to dla wielu spełnienie marzeń.',
          'Część zdarzeń w biurze też potrafi podnieść albo obniżyć humor całego zespołu. Spróbuj odwołać spotkanie, a zobaczysz.',
        ],
      },
      {
        question: 'Czy ktoś może odejść?',
        answer: [
          'Tak. Bardzo niezadowolony pracownik dostaje ostrzeżenie (i zaczyna aktualizować profil na LinkedInie), a jeśli długo nic się nie zmieni — składa wypowiedzenie. Nie ma tu losowania: wystarczy w porę poprawić warunki.',
          'Gdy warunki są dobre, zadowolenie samo wraca do normy. Owocowe czwartki nie są wymagane.',
        ],
      },
      {
        question: 'Jak mogę zadbać o zespół?',
        answer: [
          'Daj każdemu biurko — bez niego nikt nie pracuje i każdy się frustruje, nawet gdy nic nie robi.',
          'Kup tyle ekspresów i kanap, żeby nie było kolejek, i postaw je niedaleko biurek — krótsza droga to krótsza przerwa. Bez ekspresu ludzie nie robią sobie małych przerw zawczasu i częściej dochodzą do ściany.',
          'Nie dopuszczaj do wyczerpania: jeśli przyciskasz kogoś przy biurku, pamiętaj, żeby w porę wysłać go na odpoczynek. Męczy tylko praca — ktoś bez zadań odpocznie po prostu siedząc.',
          'W zdarzeniach licz się z humorem zespołu — oszczędność czasu bywa okupiona niezadowoleniem.',
          'Rośliny cieszą oko, ale na energię i humor nie wpływają. Pensja ani tempo gry — też nie.',
          'Gdy ktoś ma już ostrzeżenie, a warunków nie da się szybko poprawić, możesz go zwolnić, zanim sam odejdzie — dniówkę za ten dzień i tak zapłacisz.',
        ],
      },
    ],
  },
  {
    title: 'Pieniądze i cel misji',
    questions: [
      {
        question: 'Skąd biorę pieniądze i na co idą?',
        answer: [
          'Przyjęcie zlecenia daje zaliczkę, oddanie projektu — resztę wynagrodzenia (pomniejszoną za spóźnienie, bo klient też umie liczyć).',
          'Codziennie płacisz pensje i utrzymanie biura. Pensję dostaje każdy, kto był zatrudniony choćby przez część dnia — także zwolniony. Meble kupujesz jednorazowo, a sprzedaż zwraca tylko część ceny — rynek używanych kanap jest bezlitosny.',
        ],
      },
      {
        question: 'Kiedy przegrywam?',
        answer: [
          'Gdy po rozliczeniu dnia kasa jest na minusie, masz kilka dni na wyjście nad kreskę. Jeśli się nie uda — bankructwo, a Twój software house trafia do anegdot na meetupach. Wyjście z długu kasuje odliczanie.',
        ],
      },
      {
        question: 'Kiedy wygrywam?',
        answer: [
          'Gdy jednocześnie oddasz wymaganą liczbę projektów, zgromadzisz odpowiednią kwotę i zdobędziesz wystarczającą reputację. Progi znajdziesz w zakładce „Cel misji” — sprawdzamy je po rozliczeniu dnia.',
        ],
      },
    ],
  },
  {
    title: 'Czas i pauza',
    questions: [
      {
        question: 'Jak wygląda dzień w biurze?',
        answer: [
          'Rano ludzie przychodzą i siadają do biurek, od 9:00 do 17:00 pracują, potem wychodzą — punktualnie, co do minuty. Nadgodzin nie ma, to nie ta gra. Gdy biuro opustoszeje, rozliczasz dzień i zaczynasz następny.',
          'Przyspieszenie gry sprawia, że wszystko dzieje się szybciej, ale dokładnie tak samo — wynik nie zależy od wybranego tempa.',
        ],
      },
      {
        question: 'Kiedy gra sama się zatrzymuje?',
        answer: [
          'Przy zdarzeniu w biurze, które wymaga Twojej decyzji.',
          'Na koniec dnia pracy, gdy biuro opustoszeje — czas na rozliczenie. Nowy dzień też zaczyna się na pauzie, żeby spokojnie dopić kawę.',
          'Przy urządzaniu biura: kupowanie, przesuwanie i sprzedawanie mebli działa tylko na pauzie. Nikt nie chce, żeby mu ktoś wyniósł biurko spod laptopa.',
          'Gdy wyjdziesz z gry — przełączysz aplikację, wygasisz ekran albo zmienisz kartę przeglądarki. Po powrocie gra czeka na pauzie i niczego nie nadrabia, więc nic nie dzieje się za Twoimi plecami. Zespół też udaje, że cały czas pracował.',
          'Po wczytaniu zapisu, przed aktualizacją gry, po otwarciu gry w innej karcie i na koniec prologu.',
        ],
      },
      {
        question: 'A gdy przeglądam zakładki?',
        answer: [
          'Otwarcie Projektów, Zespołu, Finansów czy tych zasad gry nie zatrzymuje czasu — biuro żyje dalej, a termin się nie przesuwa. Jeśli chcesz spokojnie poczytać albo coś zaplanować — włącz pauzę.',
        ],
      },
    ],
  },
];

// SH-059: rozdział 2 (Scrum) — teksty zaakceptowane przez właściciela 2026-11-08. Widoczne razem
// z rozdziałem 2 (flaga wydania).
export const CHAPTER_TWO_RULES: RulesSection = {
  title: 'Rozdział 2: Scrum',
  questions: [
    {
      question: 'Co się zmienia w rozdziale 2?',
      answer: [
        'Firma wyrasta z biura i przenosi się do większego — z salką konferencyjną. Zespół, pieniądze, reputacja i rozpoczęte projekty jadą z Tobą, meble w kartonach: ustawiasz je z magazynu za darmo w trybie „Urządź”. Cele są nowe i wyższe — na szczęście nikt nie każe zaczynać od garażu.',
      ],
    },
    {
      question: 'Kim jest Scrum Master?',
      answer: [
        'Osoba, która prowadzi ceremonie: planowanie, daily i retrospektywę. Nie pisze kodu i nie bierze projektów — jej projektem jest zespół. Potrzebuje biurka.',
        'Senior zamyka daily w kwadrans, junior ma do przekazania jeszcze kilka ważnych myśli. Jeden Scrum Master na firmę w zupełności wystarczy.',
      ],
    },
    {
      question: 'Po co stół konferencyjny?',
      answer: [
        'Przy nim odbywają się wszystkie ceremonie. Krzeseł jest osiem, reszta zespołu stoi wokół — tak też jest zwinnie. Bez stołu i bez Scrum Mastera nie ma sprintów, a firma pracuje po staremu.',
      ],
    },
    {
      question: 'Jak działa sprint?',
      answer: [
        'Sprint trwa kilka dni. Pierwszego dnia rano gra się zatrzymuje i wybierasz cel sprintu — projekt, na którym zespół się skupi. Praca nad nim idzie szybciej.',
        'Oddasz go przed końcem sprintu — reputacja i humory w górę. Nie zdążysz — klient też to zauważy. Możesz też wybrać sprint bez celu: spokojniej, ale bez premii.',
      ],
    },
    {
      question: 'Co daje daily?',
      answer: [
        'Codziennie o 10:00 zespół idzie do salki. Przez chwilę nikt nie koduje, ale potem wszyscy wiedzą, co robią, i pracują szybciej do końca dnia. Premię dostają ci, którzy przyszli.',
        'Kto akurat pali, dołączy, jeśli zdąży. Jeśli wydasz komuś rozkaz w trakcie spotkania, wyjdzie z daily — i premię straci.',
      ],
    },
    {
      question: 'Czym jest retrospektywa?',
      answer: [
        'Ostatniego dnia sprintu, pod koniec pracy, zespół siada do retro i zgłasza trzy pomysły na usprawnienia. Wybierasz jeden — obowiązuje do odwołania.',
        'Każde usprawnienie ma plus i minus: pair programming ogranicza błędy, ale spowalnia; piłkarzyki poprawiają humor, ale nie skupienie. Naraz działają najwyżej trzy. Możesz też grzecznie podziękować za pomysły. Bez Scrum Mastera usprawnienia przestają działać — nikt ich nie pilnuje.',
      ],
    },
  ],
};

export function rulesSections(chapterTwo: boolean): RulesSection[] {
  return chapterTwo ? [...RULES, CHAPTER_TWO_RULES] : RULES;
}
