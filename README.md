# Sprint Happens!

Mobilna gra przeglądarkowa (PWA) o prowadzeniu software house'u. Zatrudniasz zespół, przyjmujesz kontrakty, pilnujesz terminów, błędów i budżetu — a wszystko z przymrużeniem oka wobec branży IT. Inspiracja: Theme Hospital. Widok biura w izometrycznym pixel arcie, projektowany przede wszystkim na telefon.

> **Status:** wczesna implementacja MVP. Działa szkielet aplikacji (React + zastępcza scena Phaser); mechaniki gry są w budowie.

## Wymagania

- Node.js 24 (wersja zapisana w [.nvmrc](.nvmrc))
- npm

## Uruchomienie

```bash
nvm use        # przełącza na Node 24
npm install
npm run dev    # serwer deweloperski Vite
```

Scena testowa zasłaniania (postać na stałej trasie, punkty interakcji): `http://localhost:5173/?scene=occlusion`.

## Skrypty

| Komenda                                       | Opis                                                |
| --------------------------------------------- | --------------------------------------------------- |
| `npm run dev`                                 | Serwer deweloperski                                 |
| `npm run build`                               | Sprawdzenie typów i build produkcyjny               |
| `npm run preview`                             | Podgląd buildu produkcyjnego                        |
| `npm run typecheck`                           | Sprawdzenie typów (aplikacja, silnik, konfiguracja) |
| `npm run lint`                                | ESLint                                              |
| `npm run format` / `npm run format:check`     | Formatowanie Prettier / samo sprawdzenie            |
| `npm test` / `npm run test:watch`             | Testy Vitest jednorazowo / w trybie obserwacji      |
| `npx vitest run <ścieżka>` lub `-t "<nazwa>"` | Pojedynczy plik lub test                            |

## Technologie

TypeScript 6.0, React 19, Phaser 4, Vite 8, Vitest 5, ESLint 10, Prettier 3.

## Architektura w skrócie

- **Silnik symulacji** (`src/domain`, `src/simulation`, `src/world`) — czysty TypeScript, jedyne źródło prawdy o stanie gry. Nie zależy od React, Phasera ani przeglądarki; pilnują tego osobny `tsconfig.engine.json` i reguła ESLint.
- **Scena Phaser** (`src/rendering`) — wyłącznie przedstawia biuro i postacie.
- **Interfejs React** (`src/ui`) — panele zarządcze.
- Interfejs i scena zmieniają stan wyłącznie przez polecenia wysyłane do silnika, który je waliduje.

## Konwencje

Commity w stylu [Conventional Commits](https://www.conventionalcommits.org/), np. `feat(simulation): add fixed-step clock`.
