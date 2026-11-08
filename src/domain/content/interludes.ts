// Przerywniki fabularne kampanii: przed prologiem i między rozdziałami (SH-048). Gracz jest Januszem — jak w prologu.
// Wzór: rozdział, który się zaczyna, jego nazwa w cudzysłowie i podtytuł (teksty zaakceptowane
// przez właściciela 2026-11-08).
export type InterludeId = 'beforePrologue' | 'afterPrologue' | 'afterChapterOne';

export type Interlude = {
  kicker: string;
  title: string;
  subtitle: string;
  paragraphs: readonly string[];
  button: string;
};

export const INTERLUDES: Readonly<Record<InterludeId, Interlude>> = {
  beforePrologue: {
    kicker: 'Prolog',
    title: '„Na swoim”',
    subtitle: 'Firma w garażu',
    paragraphs: [
      'Etat w korporacji się skończył — z twojej inicjatywy, co podkreślasz przy każdej okazji. Masz laptopa, garaż i pomysł na software house.',
      'Siedziba JanuszSoftu mieści się w garażu, serwerownia — na półce między wiertarką a słoikami z gwoździami. Na start wystarczy.',
      'Pierwszy klient już czeka. Wujek Zbyszek wszystko załatwił.',
    ],
    button: 'Do garażu',
  },
  afterPrologue: {
    kicker: 'Rozdział 1',
    title: '„Teraz jesteśmy firmą”',
    subtitle: 'Pierwsze prawdziwe biuro',
    paragraphs: [
      'Garaż przechodzi do historii. Dwa zlecenia, jeden pracownik i ekspres, który w końcu nie jest twoim prywatnym. Zrobiło się ciasno — szczególnie odkąd Paweł zaczął przychodzić do pracy codziennie.',
      'Wynajmujesz pierwsze prawdziwe biuro: open space, gabinet szefa i pokój relaksu z kanapą. Czynsz też jest prawdziwy.',
      'Od teraz wszystko na poważnie: kontrakty, terminy, pensje i reputacja. Klienci to już nie tylko Mirek z internetu. No, w większości.',
    ],
    button: 'Do biura',
  },
  afterChapterOne: {
    kicker: 'Rozdział 2',
    title: '„Agile, czyli szybciej”',
    subtitle: 'Firma odkrywa procesy',
    paragraphs: [
      'Firma przetrwała, a nawet urosła. Stały klient chce teraz regularnych dostaw — co dwa tygodnie, z demo i uśmiechem.',
      'Doszedłeś do wniosku, że problemem nie jest liczba przyjętych zleceń, tylko brak metody. Na LinkedInie wszyscy mają Scruma, więc wy też będziecie.',
      'Przenosicie się do większego biura z salką konferencyjną. Meble jadą w kartonach — rozstawisz je na miejscu. Zespół jedzie z wami.',
      'Na pierwsze spotkanie przychodzi konsultant od transformacji agile. Obiecuje, że będzie szybciej, lepiej i z karteczkami. Na razie wystawił fakturę.',
    ],
    button: 'Przeprowadzka',
  },
};
