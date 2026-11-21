import { useEffect } from 'react';
import type confettiModule from 'canvas-confetti';

// Confetti na zakończenie etapu (finał prologu, wygrany rozdział): jeden naturalny wybuch z dołu
// środka ekranu w górę — układ „Realistic look” z przykładów canvas-confetti (wybór właściciela
// 2026-11-21): kilka nałożonych wystrzałów o różnym rozrzucie i prędkości. Biblioteka (naturalny
// ruch: opór powietrza, grawitacja, kołysanie i koziołkowanie kartek) ładowana dopiero przy
// zwycięstwie (osobny fragment kodu, ~4 KB gzip). Animacja trwa kilka sekund i sama się kończy;
// rysowanie w workerze (OffscreenCanvas), gdy przeglądarka go wspiera. Pomijane przy
// prefers-reduced-motion.
type ConfettiCannon = typeof confettiModule;
type Burst = Parameters<ConfettiCannon>[0];

const COLORS = ['#efbe59', '#3f7d55', '#254d3d', '#d6b35e', '#b4483c', '#d5e2da'];
const TOTAL = 200;

// Udział w liczbie kartek i parametry kolejnych wystrzałów (jak w przykładzie biblioteki).
const BURSTS: readonly (readonly [number, Burst])[] = [
  [0.25, { spread: 26, startVelocity: 55 }],
  [0.2, { spread: 60 }],
  [0.35, { spread: 100, decay: 0.91, scalar: 0.8 }],
  [0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 }],
  [0.1, { spread: 120, startVelocity: 45 }],
];

function fireRealistic(confetti: ConfettiCannon): void {
  for (const [share, burst] of BURSTS) {
    void confetti({
      ...burst,
      particleCount: Math.floor(TOTAL * share),
      origin: { y: 0.7 },
      colors: COLORS,
      disableForReducedMotion: true,
    });
  }
}

export function Confetti() {
  useEffect(() => {
    let active = true;
    let instance: ConfettiCannon | null = null;
    void import('canvas-confetti').then(({ default: confetti }) => {
      if (!active) return;
      instance = confetti;
      fireRealistic(confetti);
    });
    // Zamknięcie okna w trakcie (np. „Nowa gra”) przerywa animację i zwalnia canvas.
    return () => {
      active = false;
      instance?.reset();
    };
  }, []);
  return null;
}
