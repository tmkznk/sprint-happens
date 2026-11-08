import { describe, expect, it } from 'vitest';
import { RETRO_CARDS } from '../domain/content/retroCards';
import type { ProjectId } from '../domain/contracts';
import { cardSummary, ceremonyLabel, goalLabel, scrumHint, sprintDayLabel } from './sprintDisplay';

const sprint = { number: 2, startDay: 6, endDay: 10, goalProjectId: null, goalSettled: false };

describe('etykiety sprintu (SH-058)', () => {
  it('dzień sprintu', () => {
    expect(sprintDayLabel(sprint, 8)).toBe('Sprint 2 · dzień 3/5');
  });

  it('cel sprintu', () => {
    expect(goalLabel(sprint, null)).toBe('Bez celu');
    expect(goalLabel({ ...sprint, goalProjectId: 'project-1' as ProjectId }, 'Sklep Mirka')).toBe(
      'Cel: Sklep Mirka',
    );
    expect(
      goalLabel(
        { ...sprint, goalProjectId: 'project-1' as ProjectId, goalSettled: true },
        'Sklep Mirka',
      ),
    ).toBe('Cel osiągnięty: Sklep Mirka');
  });

  it('karta: plus i minus', () => {
    const card = RETRO_CARDS[0];
    if (!card) throw new Error('brak kart');
    expect(cardSummary(card)).toBe(`${card.plus} · ${card.minus}`);
  });

  it('ceremonie', () => {
    expect(ceremonyLabel('daily')).toBe('Na daily');
    expect(ceremonyLabel('planning')).toBe('Na planowaniu');
    expect(ceremonyLabel('retro')).toBe('Na retro');
  });

  it('podpowiedź, czego brakuje do sprintów', () => {
    expect(scrumHint({ scrumMaster: false, scrumMasterDesk: false, table: false })).toBe(
      'Sprinty ruszą, gdy zatrudnisz Scrum Mastera i postawisz stół konferencyjny.',
    );
    expect(scrumHint({ scrumMaster: true, scrumMasterDesk: false, table: true })).toBe(
      'Scrum Master potrzebuje biurka.',
    );
    expect(scrumHint({ scrumMaster: true, scrumMasterDesk: true, table: false })).toBe(
      'Postaw stół konferencyjny — ceremonie odbywają się przy nim.',
    );
    expect(scrumHint({ scrumMaster: true, scrumMasterDesk: true, table: true })).toBe(
      'Pierwszy sprint zacznie się następnego dnia.',
    );
  });
});
