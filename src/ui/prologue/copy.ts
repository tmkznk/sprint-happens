import type { PrologueStep } from '../../domain/prologue';
import type { Tab } from '../navigation';

// Teksty prologu (JanuszSoft). Komunikat etapu: tytuł, krótki tekst fabularny, jednoznaczne
// zadanie i przycisk prowadzący do istniejącego panelu — gracz sam wykonuje tam czynność.
export type StepCopy = {
  title: string;
  story: string[];
  task: string;
  action: { label: string; tab: Tab };
  // Komunikat pokazuje się sam na początku kroku; pozostałe kroki są dostępne w „Cel misji”.
  announce: boolean;
};

export const STEP_COPY: Record<Exclude<PrologueStep, 'finished'>, StepCopy> = {
  acceptFirst: {
    title: 'Prezes, programista i dział sprzedaży.',
    story: [
      'Witaj w JanuszSofcie. Zatrudniasz jedną osobę: siebie. Atmosfera jest rodzinna, struktura płaska, a wszystkie konflikty w zespole rozstrzygasz pod prysznicem.',
      'Wujek Zbyszek polecił cię Mirkowi. Obiecał, że będzie szybko i tanio. Nie uznał za konieczne pytać cię o zdanie.',
    ],
    task: 'Otwórz panel zleceń i przyjmij projekt „Mirek w internecie”.',
    action: { label: 'Zobacz zlecenie', tab: 'projects' },
    announce: true,
  },
  assignOwner: {
    title: 'Dział sprzedaży skończył. Ty nie.',
    story: [
      'Zlecenie przyjęte. Teraz trzeba znaleźć kogoś, kto je wykona. Po krótkim przeglądzie zasobów ludzkich wybór padł na Janusza.',
      'Przydziel go do projektu. Prezes został poinformowany o konieczności pracy i przyjął tę wiadomość z umiarkowanym zrozumieniem.',
    ],
    task: 'Przypisz Janusza do projektu „Mirek w internecie”.',
    action: { label: 'Otwórz zespół', tab: 'team' },
    announce: true,
  },
  deliverFirst: {
    title: 'Pierwszy projekt w produkcji.',
    story: [
      'Janusz pracuje. To dobry moment, żeby poznać pauzę i tempo gry. Czas można przyspieszyć. Nabieranie doświadczenia życiowego przez klienta niestety nie.',
    ],
    task: 'Doprowadź do ukończenia i rozliczenia pierwszego projektu.',
    action: { label: 'Otwórz projekty', tab: 'projects' },
    announce: false,
  },
  buyDesk: {
    title: 'Firma rośnie. Janusz nadal jest jeden.',
    story: [
      'Pierwsze pieniądze zarobione. Możesz teraz zainwestować w rozwój firmy, czyli sprawić, żeby ktoś inny też miał gdzie pracować.',
      'Przygotuj drugie stanowisko. „Młody, weź sobie coś podłóż” nie jest jeszcze zatwierdzonym standardem wyposażenia.',
    ],
    task: 'Kup i ustaw dodatkowe stanowisko pracy.',
    action: { label: 'Urządź biuro', tab: 'furnish' },
    announce: true,
  },
  hireHelper: {
    title: 'Rekrutacja. Tym razem kandydat to nie ty.',
    story: [
      'Na stanowisko zgłosił się Paweł, backendowiec. Chce pracować przy ciekawych projektach, rozwijać kompetencje i otrzymywać wynagrodzenie. Ostatni punkt lekko zaskoczył Janusza.',
      'Poznaj kandydata i zatrudnij go. Przy kolejnym zleceniu przyda się ktoś, kto ogarnie to, czego nie widać na stronie.',
    ],
    task: 'Zatrudnij Pawła Schematowskiego.',
    action: { label: 'Poznaj kandydata', tab: 'recruit' },
    announce: true,
  },
  acceptSecond: {
    title: 'Klient wrócił. Z pomysłem.',
    story: [
      'Strona Mirka działa tak dobrze, że telefon nie przestaje dzwonić. Mirek chciał więcej klientów, ale nie przewidział, że trzeba będzie z nimi rozmawiać.',
      'Teraz potrzebuje formularza zgłoszeń i panelu do ich przeglądania. Według Mirka to jeden przycisk. Według reszty świata: kolejne zlecenie.',
    ],
    task: 'Przyjmij projekt „Mirek przyjmuje zapisy”.',
    action: { label: 'Zobacz zlecenie', tab: 'projects' },
    announce: true,
  },
  assignTeam: {
    title: 'Janusz robi przód. Paweł ogarnia resztę.',
    story: [
      'Przydziel Janusza do frontendu, a Pawła do backendu. Po raz pierwszy „przekazałem temat do innego działu” będzie oznaczało coś więcej niż przełożenie zadania na jutro.',
      'Paweł musi rzeczywiście popracować przy tym projekcie. Samo figurowanie na liście płac zostawiamy bardziej dojrzałym organizacjom.',
    ],
    task: 'Przydziel Janusza i Pawła do pracy przy drugim projekcie, zgodnie z ich rolami w tym zleceniu.',
    action: { label: 'Otwórz zespół', tab: 'team' },
    announce: true,
  },
  deliverSecond: {
    title: 'Pierwszy projekt zespołowy w toku.',
    story: [
      'Obaj mają zajęcie. Doprowadź projekt do ukończenia. To dobry moment, żeby sprawdzić postęp, zanim Mirek zapyta, czy już gotowe. Mirek zawsze pyta, czy już gotowe.',
    ],
    task: 'Ukończ „Mirek przyjmuje zapisy” z udziałem Pawła.',
    action: { label: 'Otwórz projekty', tab: 'projects' },
    announce: false,
  },
};

// Nagłówek biura w trakcie etapu.
export const STAGE_TITLES: Record<PrologueStep, string> = {
  acceptFirst: 'Pierwszy klient',
  assignOwner: 'Janusz przy robocie',
  deliverFirst: 'Janusz przy robocie',
  buyDesk: 'Miejsce dla pomocnika',
  hireHelper: 'Pierwszy pracownik',
  acceptSecond: 'Pierwszy wspólny projekt',
  assignTeam: 'Pierwszy wspólny projekt',
  deliverSecond: 'Pierwszy wspólny projekt',
  finished: 'Teraz „my” jest zgodne z prawdą',
};

export const GOALS = [
  'Przyjąć pierwsze zlecenie.',
  'Przypisać Janusza do tego zlecenia.',
  'Przygotować miejsce dla nowego pracownika.',
  'Zatrudnić nowego pracownika — backendowca.',
  'Ukończyć jeden projekt z udziałem nowego pracownika.',
];

export const FINALE = {
  title: 'JanuszSoft. Teraz naprawdę w liczbie mnogiej.',
  story: [
    'Zaczynałeś jako prezes jednoosobowego działu wszystkiego. Masz za sobą dwa zlecenia, drugie stanowisko i pierwszy projekt wykonany z pracownikiem.',
    'Możesz już mówić „skonsultuję to z zespołem” i faktycznie kogoś zapytać. Mirek jest zadowolony. Paweł jeszcze nie złożył wypowiedzenia. To bardzo dobry początek.',
  ],
  summary: [
    'Pierwsze zlecenie przyjęte.',
    'Janusz przypisany do pracy.',
    'Drugie stanowisko przygotowane.',
    'Backendowiec zatrudniony.',
    'Pierwszy wspólny projekt ukończony.',
  ],
  button: 'Zakończ prolog',
};

// Teksty blokad — po dotknięciu zablokowanego elementu.
export const LOCKS = {
  team: 'Najpierw przyjmij zlecenie. Janusz ma duży potencjał, ale potrzebuje wiedzieć, co właściwie robić.',
  furnish:
    'Najpierw ukończ pierwsze zlecenie. Entuzjazm założyciela nie jest akceptowaną formą płatności.',
  recruit:
    'Przygotuj stanowisko pracy. „Elastyczne miejsce zatrudnienia” nie oznacza siedzenia komuś na kolanach.',
  finance:
    'Wróć po rozliczeniu pierwszego projektu. Wtedy będzie co analizować z miną dyrektora finansowego.',
  rest: 'Dostępne po ukończeniu prologu. Najpierw opanuj małą firmę, zanim zaczniesz mieć duże problemy.',
  shop: 'Najpierw stanowisko dla pracownika. Roślina ma świetne podejście do nadgodzin, ale słabo programuje.',
  speed: 'Najpierw daj Januszowi pracę — zegar ruszy, gdy będzie co robić.',
};

export const RECRUIT_STORY =
  'Janusz obiecał płaską strukturę organizacyjną. Paweł nie spodziewał się, że będzie aż tak płaska, że zobaczy cały zarząd bez odwracania głowy.';

// „Z życia biura”: komentarze do osiągnięć; podczas pracy pokazywane pojedynczo, na zmianę.
export const NEWS: Record<PrologueStep, string[]> = {
  acceptFirst: ['JanuszSoft otwarty. Ekspres działa, stanowisko jest. Brakuje tylko klienta.'],
  assignOwner: [
    'Pierwszy klient zdobyty. Wujek Zbyszek już wpisuje sobie „Head of Sales” do opisu na komunikatorze.',
  ],
  deliverFirst: [
    'Janusz zrobił daily. Wszyscy obecni zgłosili ten sam problem: za dużo roboty.',
    'Wymagania Mirka: ma być nowocześnie, ale żeby nic się nie zmieniło.',
    'Dział techniczny poprosił o więcej czasu. Zarząd odrzucił prośbę. Janusz jest wściekły na Janusza.',
  ],
  buyDesk: [
    'Mirek zapłacił. Janusz trzy razy odświeżył saldo, żeby upewnić się, że to nie wersja demonstracyjna.',
  ],
  hireHelper: [
    'Drugie stanowisko gotowe. Janusz przez chwilę rozważał zatrudnienie drugiego siebie, ale odrzucił kandydata za trudny charakter.',
  ],
  acceptSecond: [
    'Paweł dołączył do zespołu. Janusz po raz pierwszy powiedział „porozmawiam z programistą” i nie musiał iść do lustra.',
  ],
  assignTeam: [
    'Paweł dołączył do zespołu. Janusz po raz pierwszy powiedział „porozmawiam z programistą” i nie musiał iść do lustra.',
  ],
  deliverSecond: [
    'Pierwsze spotkanie całego zespołu trwało trzy minuty. Janusz zapisał to jako przewagę konkurencyjną.',
    'Paweł zapytał o dokumentację. Janusz odpowiedział, że jest bardzo bezpośredni dostęp do wiedzy eksperckiej.',
    'Frontend czeka na backend. Backend pyta, co właściwie obiecał frontend. Firma osiągnęła pełną dojrzałość organizacyjną.',
    'Mirek uważa, że dane zapisują się „gdzieś w internecie”. Paweł poprosił, żeby nie zdradzać klientom szczegółów architektury.',
    'Janusz powiedział „nasz zespół” bez cudzysłowu. Paweł nie wiedział, że uczestniczy w historycznej chwili.',
  ],
  finished: [
    'Janusz dodał „CEO” do podpisu. Paweł zapytał, czy oznacza to, że ktoś inny będzie teraz wynosił śmieci.',
  ],
};
