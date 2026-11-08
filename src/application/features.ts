// Flaga wydania rozdziału 2: w trybie deweloperskim włączona, w produkcji ukryta, dopóki
// rozdział nie jest gotowy (włączenie: VITE_CHAPTER_TWO=true w `.env.production`).
export const CHAPTER_TWO_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_CHAPTER_TWO === 'true';
