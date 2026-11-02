// Odmiana: 1 osoba, 2–4 osoby (bez 12–14), pozostałe — osób.
export function peopleCount(count: number): string {
  if (count === 1) return '1 osoba';
  return `${count} ${isFew(count) ? 'osoby' : 'osób'}`;
}

// Biernik po „oddać”: 1 projekt, 2–4 projekty (bez 12–14), pozostałe — projektów.
export function projectsCount(count: number): string {
  if (count === 1) return '1 projekt';
  return `${count} ${isFew(count) ? 'projekty' : 'projektów'}`;
}

function isFew(count: number): boolean {
  const tens = count % 100;
  const units = count % 10;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14);
}
