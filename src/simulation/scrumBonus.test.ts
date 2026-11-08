import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { GameState } from '../domain/state';
import { createPlayer } from '../test/player';
import { readyChapterTwo } from '../test/scrumFixture';
import { testState } from '../test/engineFixture';
import { bonusPermilleFor, pmBonusPermille } from './work';

const { scrum } = DEFAULT_BALANCE;

// Pierwszy dzień sprintu z celem (pierwszy aktywny projekt) — automat gracza testowego.
function sprintWithGoal(): GameState {
  const player = createPlayer(DEFAULT_BALANCE, 1, readyChapterTwo().getState());
  player.finishDay();
  return player.state();
}

describe('premie Scruma w pracy (SH-054, SH-055)', () => {
  it('rozdział 1: premia jak dotąd — tylko PM', () => {
    const state = testState();
    for (const employee of Object.values(state.staff.employees)) {
      for (const project of Object.values(state.contracts.projects)) {
        expect(bonusPermilleFor(state, employee, project.id, DEFAULT_BALANCE)).toBe(
          pmBonusPermille(state, project.id, DEFAULT_BALANCE),
        );
      }
    }
  });

  it('rozdział 2: PM + cel sprintu + daily sumują się dla uczestnika daily pracującego nad celem', () => {
    let state = sprintWithGoal();
    // Wybór celu przez automat gracza następuje przy wznowieniu — tu ustawiamy go wprost.
    const goal = Object.values(state.contracts.projects).find((p) => p.status === 'active');
    if (!goal || !state.scrum?.sprint) throw new Error('setup');
    const [member, other] = Object.values(state.staff.employees).filter(
      (e) => e.projectId === goal.id,
    );
    if (!member || !other) throw new Error('setup: zespół');
    state = {
      ...state,
      scrum: {
        ...state.scrum,
        pendingGoal: false,
        sprint: { ...state.scrum.sprint, goalProjectId: goal.id },
        dailyBonus: { day: state.mission.day, employees: [member.id] },
      },
    };
    const pm = pmBonusPermille(state, goal.id, DEFAULT_BALANCE);
    expect(bonusPermilleFor(state, member, goal.id, DEFAULT_BALANCE)).toBe(
      pm + scrum.goalBonusPermille + scrum.dailyBonusPermille,
    );
    expect(bonusPermilleFor(state, other, goal.id, DEFAULT_BALANCE)).toBe(
      pm + scrum.goalBonusPermille,
    );
    // Premia daily tylko w dniu daily.
    const tomorrow = { ...state, mission: { ...state.mission, day: state.mission.day + 1 } };
    expect(bonusPermilleFor(tomorrow, member, goal.id, DEFAULT_BALANCE)).toBe(
      pm + scrum.goalBonusPermille,
    );
  });
});
