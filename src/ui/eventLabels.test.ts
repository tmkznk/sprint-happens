import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { EVENT_TEMPLATES } from '../domain/content/events';
import type { Project } from '../domain/contracts';
import { describeOption } from './eventLabels';

const project = { scopes: { frontend: 60, backend: 40 }, reward: 7000 } as unknown as Project;
const option = (event: string, index: number) => {
  const found = EVENT_TEMPLATES.find((t) => t.id === event)?.options[index];
  if (!found) throw new Error('brak opcji');
  return found;
};

describe('opisy skutków zdarzeń (EVT-02)', () => {
  it('liczbowo, z wpływem na termin', () => {
    expect(describeOption(option('small-change', 0), project, DEFAULT_BALANCE)).toEqual([
      'Zakres Frontend +20 pp',
      'Reputacja +3',
      'Termin bez zmian',
    ]);
    expect(describeOption(option('small-change', 1), project, DEFAULT_BALANCE)).toEqual([
      'Zakres Frontend +20 pp',
      'Wynagrodzenie +1400',
      'Termin +1 dzień',
    ]);
    expect(describeOption(option('coffee-strike', 0), undefined, DEFAULT_BALANCE)).toEqual([
      'Saldo −400',
    ]);
    expect(describeOption(option('open-day', 1), undefined, DEFAULT_BALANCE)).toEqual([
      'Bez skutków',
    ]);
  });
});
