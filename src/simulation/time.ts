// TIME-01 (Z): dzień pracy trwa 600 sekund czasu gry, niezależnie od tempa i długości kroku.
export const DAY_LENGTH_MS = 600_000;

export function assertValidStepMs(stepMs: number): void {
  if (!Number.isInteger(stepMs) || stepMs <= 0 || DAY_LENGTH_MS % stepMs !== 0) {
    throw new Error(
      `Krok symulacji ${stepMs} ms musi być dodatnią liczbą całkowitą dzielącą dzień`,
    );
  }
}
