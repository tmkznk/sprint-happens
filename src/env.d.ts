// Wstrzykiwane przez Vite (vite.config.ts).
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  // Kod witryny GoatCounter; brak wyłącza statystyki.
  readonly VITE_GOATCOUNTER_CODE?: string;
}
