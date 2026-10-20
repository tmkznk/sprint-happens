// TIME-T01 (R): robocza długość kroku symulacji; do walidacji prototypem.
export const STEP_MS = 100;

// TIME-01 (Z): dzień pracy trwa 600 sekund czasu gry.
export const DAY_LENGTH_MS = 600_000;

export const STEPS_PER_DAY = DAY_LENGTH_MS / STEP_MS;
