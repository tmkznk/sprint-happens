// Odmiana: 1 osoba, 2–4 osoby (bez 12–14), pozostałe — osób.
export function peopleCount(count: number): string {
  if (count === 1) return '1 osoba';
  const tens = count % 100;
  const units = count % 10;
  const few = units >= 2 && units <= 4 && (tens < 12 || tens > 14);
  return `${count} ${few ? 'osoby' : 'osób'}`;
}
