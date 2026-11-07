// Zakładka „Zasady gry”: FAQ dla gracza — obrazowo, bez liczb balansu (te mogą się zmieniać).
// Treść musi zgadzać się z regułami silnika (src/simulation) — przy zmianie mechaniki popraw też tutaj.

export type RulesQuestion = { question: string; answer: string[] };
export type RulesSection = { title: string; questions: RulesQuestion[] };

export const RULES_INTRO =
  'Krótki przewodnik po tym, jak naprawdę działa Twój software house. Bez tabelek w Excelu — ' +
  'same zasady, które przydają się, gdy termin płonie, a ekspres właśnie odmówił współpracy.';

export const RULES: RulesSection[] = [
  {
    title: 'Praca nad projektem',
    questions: [
      {
        question: 'Kto robi co w projekcie?',
        answer: [
          'Projekt składa się z części technicznych — frontendu, backendu, aplikacji mobilnej czy wdrożenia. Każdą robi developer tej specjalizacji. Wszystkie części idą równolegle: backendowiec nie czeka na frontendowca.',
          'Do tego dochodzą role wspierające: QA testuje, Designer dopieszcza wygląd, a PM pilnuje, żeby wszystko szło sprawniej.',
        ],
      },
      {
        question: 'Czy więcej developerów to szybciej?',
        answer: [
          'Tak. Dwóch frontendowców w jednym projekcie skończy frontend mniej więcej dwa razy szybciej — ich praca po prostu się sumuje. Nie ma tu klątwy „dziewięć kobiet nie urodzi dziecka w miesiąc”.',
          'Pamiętaj tylko, że przyspieszasz wyłącznie ich część. Projekt jest gotowy dopiero, gdy skończone są wszystkie części techniczne — najwolniejsza z nich wyznacza tempo. A każda dodatkowa osoba to dodatkowa pensja.',
        ],
      },
      {
        question: 'Junior, mid, senior — co za różnica?',
        answer: [
          'Senior pracuje szybciej i myli się znacznie rzadziej. Junior jest tańszy, ale wolniejszy i robi więcej błędów. Mid jest pośrodku.',
          'Gdy nad jedną częścią pracuje kilka osób, jakość zależy od tego, kto ile napisał — senior z juniorem dają wynik pośredni.',
        ],
      },
      {
        question: 'Po co mi PM?',
        answer: [
          'PM nie pisze kodu, ale przyspiesza cały zespół swojego projektu — developerów, testerów i naprawy błędów. Im bardziej doświadczony PM, tym większy zastrzyk tempa.',
          'Pracuje tylko przy swoim biurku, więc też się męczy i potrzebuje przerw.',
        ],
      },
      {
        question: 'A Designer?',
        answer: [
          'Designer pracuje obok techniki, nad wyglądem projektu. Nie jest wymagany do oddania, ale dobry design to dodatkowa reputacja — tym większa, im bardziej klientowi na nim zależy. Częściowy design daje część premii, brak designu nie jest karany.',
        ],
      },
      {
        question: 'Kiedy ktoś w ogóle pracuje?',
        answer: [
          'Tylko przy własnym biurku, przydzielony do projektu, w godzinach pracy i nie w trakcie przerwy. Osoba bez biurka nie pracuje wcale — kup stanowisko i je przydziel.',
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
          'Z pisania kodu. Każdy kawałek nowej pracy może zawierać błąd — junior wpuszcza ich więcej niż senior, a zmęczony więcej niż wypoczęty.',
          'Błędy są niewidoczne. Dopóki nikt ich nie znajdzie, nie wiesz, ile ich jest — dokładnie jak w prawdziwym życiu.',
        ],
      },
      {
        question: 'Co robi QA?',
        answer: [
          'QA testuje już napisaną pracę, kawałek po kawałku, i wykrywa ukryte w niej błędy. Tester nie wie, gdzie są błędy, więc sprawdza wszystko — także to, co okaże się bezbłędne.',
          'QA błędów nie naprawia. Wykryty błąd trafia z powrotem do developerów.',
          'W projekcie widzisz pokrycie testami i liczbę wykrytych błędów. Niskie pokrycie oznacza, że w kodzie może czaić się więcej niespodzianek.',
        ],
      },
      {
        question: 'Kto naprawia błędy?',
        answer: [
          'Developer tej specjalizacji, w której błąd powstał: błąd frontendu naprawi tylko frontendowiec, błąd backendu — tylko backendowiec. Nie musi to być autor błędu, wystarczy ktoś z tej roli w projekcie.',
          'Developer najpierw kończy swoją część, a dopiero potem bierze się za naprawy. Naprawa jest szybka, nie tworzy nowych błędów i nie wymaga ponownego testu.',
          'Kilku developerów tej samej roli naprawia różne błędy jednocześnie.',
        ],
      },
      {
        question: 'Co jeśli zabiorę z projektu jedynego frontendowca?',
        answer: [
          'Wtedy nikt nie naprawi błędów frontendu — QA może je dalej wykrywać, ale będą wisieć. Jeśli frontend nie był skończony, stanie też jego dalsza budowa.',
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
          'Gdy skończone są wszystkie części techniczne. Testy, design i naprawy nie są wymagane — ale ich brak odbije się na ocenie.',
        ],
      },
      {
        question: 'Jak klient ocenia projekt?',
        answer: [
          'Liczą się terminowość, jakość techniczna i design. Za oddanie w terminie jest premia do reputacji, za każdy dzień spóźnienia — kara i mniejsza wypłata.',
          'Jakość zależy od wszystkich nienaprawionych błędów — także tych, których QA nie zdążyło znaleźć. Klient je znajdzie. Większy projekt zniesie więcej błędów niż mały.',
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
          'Energia spada podczas pracy. Zmęczona osoba pracuje wolniej i robi więcej błędów, a bez energii nie robi nic.',
          'Chodzenie, czekanie czy brak zadań nie męczą — męczy tylko praca.',
        ],
      },
      {
        question: 'Kawa czy kanapa?',
        answer: [
          'Ludzie sami robią sobie przerwy, gdy czują zmęczenie. Kawa to szybki zastrzyk energii, kanapa — dłuższy, porządny odpoczynek dla naprawdę wykończonych.',
          'Za mało ekspresów i kanap oznacza kolejki, a czas w kolejce to czas bez pracy. Przy większym zespole warto dokupić miejsca odpoczynku.',
          'Niektórzy wychodzą też na papierosa na taras — to przerwa, która energii nie dodaje.',
        ],
      },
      {
        question: 'Czy mogę sam wysłać kogoś na przerwę?',
        answer: [
          'Tak. Zaznacz postać w biurze i wyślij ją do ekspresu, na kanapę, do biurka albo na wybrane miejsce. Odpoczynek na kanapie z Twojego polecenia trwa przynajmniej chwilę, nawet gdy ktoś jest już wypoczęty.',
          'Po kawie czy kanapie z Twojego polecenia pracownik sam wraca do biurka i dalej chodzi na przerwy jak zwykle.',
          'Inaczej, gdy odeślesz kogoś do biurka albo w wybrane miejsce: wtedy nie pójdzie sam na przerwę, dopóki nie padnie ze zmęczenia (albo do końca dnia). Gdy termin goni, to działa — ale zmęczony robi więcej błędów i traci humor.',
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
          'Brak przydziału do projektu nikomu nie przeszkadza — siedzenie bez zadań to dla wielu spełnienie marzeń.',
          'Część zdarzeń w biurze też potrafi podnieść albo obniżyć humor całego zespołu.',
        ],
      },
      {
        question: 'Czy ktoś może odejść?',
        answer: [
          'Tak. Bardzo niezadowolony pracownik dostaje ostrzeżenie, a jeśli długo nic się nie zmieni — składa wypowiedzenie. Nie ma tu losowania: wystarczy w porę poprawić warunki.',
          'Gdy warunki są dobre, zadowolenie samo wraca do normy.',
        ],
      },
      {
        question: 'Jak mogę zadbać o zespół?',
        answer: [
          'Daj każdemu biurko — bez niego nikt nie pracuje i każdy się frustruje, nawet gdy nic nie robi.',
          'Kup tyle ekspresów i kanap, żeby nie było kolejek, i postaw je niedaleko biurek — krótsza droga to krótsza przerwa. Bez ekspresu ludzie nie robią sobie małych przerw zawczasu i częściej dochodzą do zmęczenia.',
          'Nie dopuszczaj do wyczerpania: jeśli trzymasz kogoś przy biurku poleceniami, pamiętaj, żeby w porę wysłać go na odpoczynek. Męczy tylko praca — ktoś bez zadań odpocznie po prostu siedząc.',
          'Ważąc decyzje w zdarzeniach, licz się z humorem zespołu — oszczędność czasu bywa okupiona niezadowoleniem.',
          'Rośliny cieszą oko, ale na energię i humor nie wpływają. Wysokość pensji ani tempo gry — też nie.',
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
          'Przyjęcie zlecenia daje zaliczkę, oddanie projektu — resztę wynagrodzenia (pomniejszoną za spóźnienie).',
          'Codziennie płacisz pensje i utrzymanie biura. Pensję dostaje każdy, kto był zatrudniony choćby przez część dnia — także zwolniony. Meble kupujesz jednorazowo, a sprzedaż zwraca tylko część ceny.',
        ],
      },
      {
        question: 'Kiedy przegrywam?',
        answer: [
          'Gdy po rozliczeniu dnia kasa jest na minusie, masz kilka dni na wyjście nad kreskę. Jeśli się nie uda — bankructwo. Wyjście z długu kasuje odliczanie.',
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
          'Rano ludzie przychodzą i siadają do biurek, od 9:00 do 17:00 pracują, potem wychodzą. Gdy biuro opustoszeje, rozliczasz dzień i zaczynasz następny.',
          'Przyspieszenie gry sprawia, że wszystko dzieje się szybciej, ale dokładnie tak samo — wynik nie zależy od wybranego tempa.',
        ],
      },
      {
        question: 'Kiedy gra sama się zatrzymuje?',
        answer: [
          'Przy zdarzeniu w biurze, które wymaga Twojej decyzji.',
          'Na koniec dnia pracy, gdy biuro opustoszeje — czas na rozliczenie. Nowy dzień też zaczyna się na pauzie.',
          'Przy urządzaniu biura: kupowanie, przesuwanie i sprzedawanie mebli działa tylko na pauzie.',
          'Gdy wyjdziesz z gry — przełączysz aplikację, wygasisz ekran albo zmienisz kartę przeglądarki. Po powrocie gra czeka na pauzie i niczego nie nadrabia, więc nic nie dzieje się za Twoimi plecami.',
          'Po wczytaniu zapisu, przed aktualizacją gry, po otwarciu gry w innej karcie i na koniec prologu.',
        ],
      },
      {
        question: 'A gdy przeglądam zakładki?',
        answer: [
          'Otwarcie Projektów, Zespołu, Finansów czy tych zasad gry nie zatrzymuje czasu. Jeśli chcesz spokojnie poczytać albo coś zaplanować — włącz pauzę.',
        ],
      },
    ],
  },
];
