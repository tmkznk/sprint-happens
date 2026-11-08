// Kampania: rozdział 1 (pierwsze biuro) i rozdział 2 („Agile, czyli szybciej”, większe biuro).
export const CHAPTERS = [1, 2] as const;
export type Chapter = (typeof CHAPTERS)[number];
