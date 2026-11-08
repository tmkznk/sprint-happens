import type { RetroCardId } from '../scrum';

// SH-056: karty usprawnień z retrospektywy — każda z plusem i minusem, efekty wyłącznie przez
// istniejące parametry. Lista zaakceptowana przez właściciela 2026-11-08 (SH-057); liczby — B.
export type RetroCardEffect = {
  // Tempo pracy (technika, naprawy, design), ‰.
  workPermille?: number;
  // Ryzyko błędu na fragment, ‰ (ujemne — mniej błędów).
  bugRiskPermille?: number;
  // Tempo testów QA, ‰.
  testPermille?: number;
  // Zużycie energii przy pracy, ‰ (ujemne — wolniej).
  drainPermille?: number;
  // Zadowolenie zespołu na początku każdego dnia, punkty.
  satisfactionPerDay?: number;
  // Długość ceremonii, ‰.
  ceremonyPermille?: number;
};

export type RetroCard = {
  id: RetroCardId;
  title: string;
  text: string;
  plus: string;
  minus: string;
  effect: RetroCardEffect;
};

const card = (id: string, rest: Omit<RetroCard, 'id'>): RetroCard => ({
  id: id as RetroCardId,
  ...rest,
});

export const RETRO_CARDS: readonly RetroCard[] = [
  card('definitionOfDone', {
    title: 'Definition of Done',
    text: '„Zrobione” znaczy teraz zrobione. Nikt nie wie, kto to wymyślił, ale wszyscy się boją.',
    plus: 'Mniej błędów',
    minus: 'Praca trochę wolniej',
    effect: { bugRiskPermille: -300, workPermille: -100 },
  }),
  card('noMeetingWednesday', {
    title: 'Środy bez spotkań',
    text: 'Jeden dzień w tygodniu bez kalendarza. Pozostałe dni nadrabiają z nawiązką.',
    plus: 'Wolniejsze zmęczenie',
    minus: 'Dłuższe ceremonie',
    effect: { drainPermille: -100, ceremonyPermille: 200 },
  }),
  card('pairProgramming', {
    title: 'Pair programming',
    text: 'Dwie osoby, jedna klawiatura, zero prywatności. Błędy nie mają gdzie się schować.',
    plus: 'Dużo mniej błędów',
    minus: 'Praca wolniej',
    effect: { bugRiskPermille: -500, workPermille: -200 },
  }),
  card('foosball', {
    title: 'Piłkarzyki w open space',
    text: 'Integracja przez rywalizację. Stół stoi obok osób, które potrzebują skupienia.',
    plus: 'Zadowolenie rośnie',
    minus: 'Praca odrobinę wolniej',
    effect: { satisfactionPerDay: 2, workPermille: -50 },
  }),
  card('automatedTests', {
    title: 'Testy automatyczne',
    text: 'Pipeline świeci na zielono. Na czerwono świeci tylko w piątki o 16:55.',
    plus: 'Szybsze testy',
    minus: 'Praca odrobinę wolniej',
    effect: { testPermille: 250, workPermille: -50 },
  }),
  card('timeboxing', {
    title: 'Timeboxing',
    text: 'Każde spotkanie ma klepsydrę. Niektóre także osobę, która ją pilnuje z zapałem.',
    plus: 'Krótsze ceremonie',
    minus: 'Zadowolenie spada',
    effect: { ceremonyPermille: -300, satisfactionPerDay: -1 },
  }),
  card('storyPointsBoard', {
    title: 'Story pointy na tablicy',
    text: 'Velocity rośnie. Nikt nie wie, czy to praca, czy inflacja punktów.',
    plus: 'Praca szybciej',
    minus: 'Zadowolenie spada',
    effect: { workPermille: 100, satisfactionPerDay: -1 },
  }),
  card('pairReview', {
    title: 'Code review we dwoje',
    text: 'Każdy merge zatwierdzają dwie osoby. Trzecia pyta, czemu tak długo.',
    plus: 'Mniej błędów',
    minus: 'Praca wolniej',
    effect: { bugRiskPermille: -250, workPermille: -100 },
  }),
  card('asyncDaily', {
    title: 'Asynchroniczne daily na Slacku',
    text: 'Wszyscy piszą, nikt nie czyta.',
    plus: 'Dużo krótsze ceremonie',
    minus: 'Więcej błędów',
    effect: { ceremonyPermille: -500, bugRiskPermille: 100 },
  }),
  card('specialtyCoffee', {
    title: 'Kawa speciality',
    text: 'Ekspres z młynkiem. Kolejka do niego to nowe spotkanie integracyjne.',
    plus: 'Wolniejsze zmęczenie',
    minus: 'Praca odrobinę wolniej',
    effect: { drainPermille: -150, workPermille: -50 },
  }),
  card('fridayHackathon', {
    title: 'Hackathon w piątki',
    text: 'Raz w tygodniu robimy, co chcemy. Zwykle to samo, ale z naklejkami.',
    plus: 'Zadowolenie rośnie',
    minus: 'Praca wolniej',
    effect: { satisfactionPerDay: 2, workPermille: -100 },
  }),
];

export function retroCardById(id: RetroCardId): RetroCard | undefined {
  return RETRO_CARDS.find((c) => c.id === id);
}
