# Pomieszczenia renderowane w 3D — zasady

Pomieszczenie (podłoga, ściany, drzwi, dekoracje ścian) jest renderowane w całości z modeli paczki
VNB Low Poly Office Set 2 tą samą kamerą co meble i podmienia w grze rysowane bryłami podłogi
i ściany. Pierwszy przykład: biuro prologu (`rooms.mjs` → `prologue`). Zasady zebrane z uwag
właściciela przy prologu — stosować przy każdym kolejnym pomieszczeniu (poziomie).

## Proces

1. **Najpierw makiety, potem gra.** Kilka wariantów wystroju jako zrzuty do wyboru; grafiki trafiają
   do repozytorium dopiero po akceptacji właściciela.
2. Układ logiczny w grze (`src/world/officeLayout.ts`: pokoje, drzwi, ściany, `placementStart`)
   i opis renderu (`rooms.mjs`) muszą się zgadzać — nic tego nie sprawdza automatycznie.
3. Render:
   ```bash
   cd tools/furniture-render && npm install
   VNB_PACK="/ścieżka/VNB Low Poly Office Set 2" npm run render -- rooms
   ```
   Wynik: `src/assets/rooms/<id>-back.png`, `<id>-front.png` i `src/rendering/roomSprites.json`.
   Nie commitować `package-lock.json` narzędzia.
4. Podpięcie: układ → id pomieszczenia w `ROOM_OF_LAYOUT` (`src/rendering/roomSprites.ts`).
5. Sprawdzenie w grze (telefon ~420 px i desktop): kafelki pod meblami, narożniki ścian, drzwi,
   postać na starcie, tryb „Urządź” (podgląd mebla na polu).

## Siatka i kamera

- 1 pole = 0,75 m. W scenie 3D: x pola → X, y pola → Z, wysokość w metrach (`T(m) = m / 0,75`).
- Kamera izometryczna 2:1 (azymut 45°, elewacja 30°), 64 × 32 px na pole, obraz w podwójnej
  rozdzielczości. Kotwica obrazu = punkt (0, 0) siatki — obraz leży dokładnie na siatce gry.
- Światło jak przy meblach (półkula + słońce z lewej góry), żeby cienie i odcienie pasowały do mebli.

## Warstwy i zasłanianie

- **back** — podłoga, wysokie ściany, drzwi, dekoracje; w grze pod całą sceną.
- **front** — tylko niskie ściany od strony kamery; w grze nad całą sceną (postacie i meble stoją
  zawsze za nimi). Reszta sceny zapisuje w tej warstwie tylko głębię.
- To działa, gdy niskie ściany leżą wyłącznie na zewnętrznym obrysie od strony kamery. Ściany
  działowe wewnątrz biura (wiele pokoi) wymagają osobnych kawałków z własną głębokością — do
  rozwiązania przy pierwszym takim pomieszczeniu.

## Ściany

- Tafla na linii środka pola ściany (jak w grze), grubość 0,22 pola.
- **Wysokie ściany tylne** (x = 0 i y = 0): 2,4 m — wyraźnie wyższe niż drzwi (ok. 2,1 m).
- **Ściany od strony kamery: niskie** (0,35 m). **Ściany działowe: niskie** — musi być widać,
  co jest w narożnikach pokoi.
- **Narożniki:** wysokie ściany sięgają do zewnętrznego narożnika; niskie dochodzą do lica
  wysokiej. Bryły się nie przenikają.
- **Jeden kolor dla wszystkich ścian pomieszczenia** — różnice daje światło; bok wysokiej ściany
  i przód niskiej to jedna płaszczyzna, muszą mieć ten sam odcień.
- Bez listew przypodłogowych. Wierzch niskich ścian w kolorze ściany i bez cieni (bez szarych
  krawędzi i ciemnych klinów).
- Okien w paczce nie ma — nie dorabiamy ich; ściany ozdabiają dekoracje.

## Podłoga

- Kafelki dokładnie na polach pokoju (fuga na granicach pól) — meble i postacie stoją równo na
  kafelkach.
- Między ścianą a pierwszym rzędem kafelków pas podłogi bez fug (połowa pola ściany), w odcieniu
  ciemniejszego kafelka.
- Dwa odcienie kafelków na przemian i fuga (prolog: drewno `0xb98e5e` / `0xb08657`, fuga `0x7e5f3c`).

## Drzwi

- Modele z paczki: `Door_Frame` + skrzydło `Door_2` (brązowe z okienkiem) albo `Door_1` +
  klamka `Door_Handle_1`. **Oryginalny rozmiar — nie zwężać** do szerokości pola. W grze
  przejście nadal zajmuje jedno pole; ościeżnica wizualnie wchodzi na sąsiednie pola ściany.
- **Drzwi wejściowe w wysokiej ścianie** (widoczne w całości), osadzone w niej: otwór 1,10 m
  wyśrodkowany na polu drzwi, nadproże od 2,1 m do szczytu ściany.
- Za drzwiami jasna zaślepka (niewidoczna dla kamery) — bez plamy światła na podłodze, przez szybę
  widać jasny „korytarz”.
- Nowa postać pojawia się w biurze na pierwszym polu na wprost drzwi, nie w progu (`spawnCell`).
- Pozycję drzwi sprawdzić regułami gry (dostęp do mebli, `validateAccess`) — nie każde pole ściany
  się nadaje.

## Pola gry są wolne

- **Na polach pokoju nie stoi nic poza meblami gry** (osobne obrazki, logika w silniku): bez
  dywaników, wycieraczek, półek ani roślin dekoracyjnych.
- Dekoracje tylko na ścianach: `Painting`, `Painting_Small`, `Painting_Photo`, `Vent` (obrazy na
  wysokości ok. 1,5–1,8 m, kratka ok. 2 m). Nie mogą kolidować z drzwiami.
- Meble startowe nie mogą zasłaniać wejścia (w prologu usunięty kwiatek przy drzwiach).
- Pojemność pokoju sprawdza test silnika (np. prolog: dokładnie jedno miejsce na drugie biurko).

## Paczka — pułapki

- Pliki MTL obrazów odwołują się do `Paintings.png.png` — serwer narzędzia poprawia nazwę.
- Modele paczki współdzielą materiały z pamięcią podręczną; przy zmianie materiału (np. ukrycie
  w warstwie `front`) zawsze na kopii.

## Postacie

- Atlasy z `characters.mjs`: wygląd z listy postaci, koszulka wg stanowiska; wyjątki w
  `SHIRT_OVERRIDES` (Janusz z prologu — ciemnozielona). Pojedynczą postać renderuje
  `npm run render -- <id osoby>`.
