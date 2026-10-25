import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Okna modalne renderowane bezpośrednio w <body>: style kontenera, z którego okno wywołano
// (np. kafelek pracownika), nie wpływają na jego wygląd, a rozmycie tła panelu zakładek
// (backdrop-filter tworzy obszar odniesienia dla position: fixed) nie ogranicza jego położenia.
export function ModalLayer({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
