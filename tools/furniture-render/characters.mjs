// Własne postacie: wygląd z listy postaci gry, kolor koszulki wg stanowiska,
// kierunki i animacje atlasu.
import { PEOPLE, PROLOGUE_OWNER } from '../../src/domain/content/people.ts';

// Koszulka wg stanowiska (czytelność w biurze; paleta zgodna z tłem awatarów).
const SHIRTS = {
  frontend: '#e0a33a',
  backend: '#3a6fa8',
  mobile: '#7b5bb5',
  devops: '#3f8a5a',
  qa: '#c8553d',
  designer: '#d0679b',
  pm: '#59606b',
  // Rozdział 2 (SH-053): morski — inny niż zieleń DevOpsa i niebieski backendu.
  scrumMaster: '#2a9d8f',
};
// Na tyle jasne, żeby splot dżinsu był widoczny.
const PANTS = ['#3f5480', '#4a4f5c', '#5a5a80', '#3d4048', '#6e5c48', '#4c5f50'];

const hash = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Janusz (właściciel z prologu) — własna, ciemnozielona koszulka zamiast koloru stanowiska.
const SHIRT_OVERRIDES = { [PROLOGUE_OWNER.id]: '#2f5236' };

export const LOOKS = [...PEOPLE, PROLOGUE_OWNER].map((person) => ({
  id: person.id,
  cigarettesPerDay: person.cigarettesPerDay ?? 0,
  look: {
    ...person.appearance,
    shirt: SHIRT_OVERRIDES[person.id] ?? SHIRTS[person.specialization],
    pants: PANTS[hash(person.id) % PANTS.length],
  },
}));

// Kąt obrotu modelu (przód = +Z) dla kierunku patrzenia w siatce gry (x → +X, y → +Z).
export const FACINGS = [
  { name: 'px', angle: 90 },
  { name: 'py', angle: 0 },
  { name: 'nx', angle: 270 },
  { name: 'ny', angle: 180 },
];

// Wysokość siedziska nad podłogą (m) — krzesło (poduszka do 0,59 m) i kanapa z paczki VNB.
export const CHAIR_SEAT = 0.55;
export const SOFA_SEAT = 0.38;

export const ANIMS = [
  { name: 'idle', frames: 2, fps: 1 },
  { name: 'walk', frames: 8, fps: 12 },
  { name: 'sitChair', frames: 1, fps: 1, seat: CHAIR_SEAT },
  { name: 'typing', frames: 4, fps: 8, seat: CHAIR_SEAT },
  { name: 'sitSofa', frames: 1, fps: 1, seat: SOFA_SEAT },
  { name: 'coffee', frames: 6, fps: 4 },
];

export const CHARACTER = {
  metersPerTile: 0.75,
  heightM: 1.72,
  // Ramka klatki w kaflach: szerokość, wysokość, położenie stóp od góry.
  box: { w: 1.5, h: 2.7, up: 2.3 },
};

// Palenie: osobny mały atlas tylko dla palaczy, jeden kierunek (py). Ramka inna niż w atlasie
// postaci: wyższa (dym nad głową), a węższa w prawo, bo pali się tą ręką z lewej strony.
export const SMOKE_ANIM = { name: 'smoke', frames: 6, fps: 4 };
export const SMOKE_FACINGS = FACINGS.filter((facing) => facing.name === 'py');
export const SMOKE_CHARACTER = { ...CHARACTER, box: { w: 1.06, h: 2.8, up: 2.6, left: 0.75 } };

// Wspólny cień postaci: jeden obrazek pod każdą stojącą postacią, w tym samym świetle co meble.
export const SHADOW_ANIM = { name: 'idle', frames: 1, fps: 1 };
export const SHADOW_CHARACTER = {
  ...CHARACTER,
  shadowOnly: true,
  box: { w: 1.6, h: 0.49, up: 0.15, left: 0.25 },
};
