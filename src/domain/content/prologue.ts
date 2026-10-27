import type { Furniture } from '../furniture';
import type { ContractTemplate } from './contracts';
import type { Person } from './people';

// Treść prologu (JanuszSoft): właściciel, pierwszy pomocnik, dwa zlecenia Mirka i wyposażenie
// garażu. Prolog korzysta z obecnych reguł gry — tu są tylko jego dane startowe (B).

// Janusz jest w zespole od początku i nie trafia na rynek pracy (poza listą PEOPLE).
// Wygląd w biurze: atlas istniejącej postaci (`sprite`), dopóki nie powstanie własny.
export const PROLOGUE_OWNER: Person & { sprite: string } = {
  id: 'janusz-wlasciciel',
  name: 'Janusz',
  specialization: 'frontend',
  seniority: 'mid',
  appearance: { skin: '#f5d3b8', hair: '#2a1d14', hairStyle: 'quiff', glasses: false },
  bio: 'Założyciel, prezes, programista i osoba upoważniona do wynoszenia śmieci. Zna frontend, backend i numer do człowieka, który zna resztę. Odszedł z etatu, bo nie chciał, żeby ktoś mówił mu, co ma robić. Teraz robią to wszyscy klienci.',
  sprite: 'marek-srednik',
};

// Jedyny kandydat prologu — postać z obsady gry (karta, poziom i pensja bez zmian).
export const PROLOGUE_HELPER_ID = 'pawel-schematowski';

export const PROLOGUE_HELPER_BIO =
  'Nazywa zmienne tak dokładnie, że dokumentacja czuje się zbędna. Na każde pytanie odpowiada „to zależy” i rysuje diagram. Lubi backend, bo użytkownik nie może poprosić, żeby baza danych była bardziej beżowa. Jeszcze nie poznał Mirka.';

// Zlecenia prologu nie trafiają do losowania tablicy właściwej misji.
export const PROLOGUE_FIRST_CONTRACT: ContractTemplate = {
  id: 'prolog-mirek-w-internecie',
  level: 1,
  name: 'Mirek w internecie',
  description:
    'Mirek potrzebuje prostej strony: lista usług, godziny pracy i numer telefonu. Numer musi być szczególnie widoczny, bo Mirek uważa, że klienci nie dzwonią dlatego, że nie mogą go znaleźć. Żona ma inną teorię, ale nie została uwzględniona w briefie. Klient trafił do ciebie z polecenia wujka Zbyszka, który obiecał rabat rodzinny. Nie ustalono jeszcze, do której rodziny należy Mirek.',
  scopes: { frontend: 6 },
  design: 0,
  deadlineDays: 3,
  reward: 6_000,
  advance: 1_800,
  latePenaltyPerDay: 600,
};

export const PROLOGUE_SECOND_CONTRACT: ContractTemplate = {
  id: 'prolog-mirek-przyjmuje-zapisy',
  level: 1,
  name: 'Mirek przyjmuje zapisy',
  description:
    'Po uruchomieniu strony klienci zaczęli dzwonić. Mirek uznał to za poważny problem organizacyjny. Chce formularza, w którym będzie można opisać remont, oraz panelu, w którym zobaczy zgłoszenia i zdecyduje, komu powiedzieć „najwcześniej w listopadzie”. Formularz ma działać sam. Panel też. Idealnie byłoby, gdyby sam działał również remont, ale to zostawiamy na kolejną wersję.',
  scopes: { frontend: 6, backend: 6 },
  design: 0,
  deadlineDays: 3,
  reward: 10_000,
  advance: 3_000,
  latePenaltyPerDay: 1_000,
};

export const PROLOGUE_CLIENT = 'Mirek — usługi remontowe';

// (B) Saldo startowe prologu: po rozliczeniu pierwszego zlecenia wystarcza na stanowisko
// i pensję pomocnika przy obecnych kosztach gry (sprawdza test silnika).
export const PROLOGUE_STARTING_CASH = 3_000;

// Garaż: jedno stanowisko, kanapa i ekspres (pozycje jak w biurze właściwej misji).
export const PROLOGUE_FURNITURE: readonly Omit<Furniture, 'id'>[] = [
  { type: 'desk', origin: { x: 2, y: 2 }, rotation: 0 },
  { type: 'sofa', origin: { x: 13, y: 9 }, rotation: 0 },
  { type: 'coffeeMachine', origin: { x: 17, y: 8 }, rotation: 0 },
];
