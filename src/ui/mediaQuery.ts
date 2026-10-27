import { useSyncExternalStore } from 'react';

// Zgodność układu z progami w app.css: telefon — pełnoekranowe panele, szeroki ekran — „Plan”.
export const PHONE_LAYOUT = '(max-width: 899.98px)';
export const WIDE_LAYOUT = '(min-width: 1200px)';

export function useMediaQuery(query: string): boolean {
  const media = window.matchMedia(query);
  return useSyncExternalStore(
    (listener) => {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    },
    () => media.matches,
  );
}
