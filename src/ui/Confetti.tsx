import { useEffect } from 'react';
import type confettiModule from 'canvas-confetti';

// Confetti na zakończenie etapu (finał prologu, wygrany rozdział): wystrzał z czterech narożników
// ekranu w stronę środka. canvas-confetti (wybór właściciela 2026-11-21 — naturalny ruch: opór
// powietrza, grawitacja, kołysanie i koziołkowanie kartek) ładowane dopiero przy zwycięstwie
// (osobny fragment kodu, ~7 KB gzip). Animacja trwa kilka sekund i sama się kończy; rysowanie
// w workerze (OffscreenCanvas), gdy przeglądarka go wspiera. Pomijane przy prefers-reduced-motion.
type ConfettiCannon = typeof confettiModule;

const COLORS = ['#efbe59', '#3f7d55', '#254d3d', '#d6b35e', '#b4483c', '#d5e2da'];

// Narożniki: punkt startu (ułamek ekranu) i kąt lotu do środka (stopnie, 90 = w górę).
const CORNERS = [
  { x: 0, y: 0, angle: 315 },
  { x: 1, y: 0, angle: 225 },
  { x: 0, y: 1, angle: 45 },
  { x: 1, y: 1, angle: 135 },
] as const;

function fireFromCorners(confetti: ConfettiCannon): void {
  // Zasięg ≈ prędkość / (1 − decay) — dobrany tak, by kartki dolatywały w okolice środka
  // niezależnie od rozmiaru ekranu. Dolne narożniki strzelają mocniej (pod grawitację).
  const toCenter = Math.hypot(window.innerWidth, window.innerHeight) / 2;
  for (const corner of CORNERS) {
    const upward = corner.y === 1;
    void confetti({
      particleCount: 40,
      origin: { x: corner.x, y: corner.y },
      angle: corner.angle,
      spread: 50,
      startVelocity: (toCenter / 10) * (upward ? 1.25 : 0.8),
      decay: 0.9,
      gravity: 1,
      ticks: 260,
      scalar: 0.9,
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
      fireFromCorners(confetti);
    });
    // Zamknięcie okna w trakcie (np. „Nowa gra”) przerywa animację i zwalnia canvas.
    return () => {
      active = false;
      instance?.reset();
    };
  }, []);
  return null;
}
