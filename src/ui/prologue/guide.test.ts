import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../../domain/config';
import { createInitialState } from '../../domain/state';
import type { EmployeeId } from '../../domain/employees';
import { createPrologueState, prologueOwner } from '../../simulation/prologue';
import { createPlayer } from '../../test/player';
import { LOCKS } from './copy';
import { guideAction, navTarget, tabLock } from './guide';

const SEED = 7;

function prologuePlayer() {
  return createPlayer(DEFAULT_BALANCE, SEED, createPrologueState(DEFAULT_BALANCE, SEED));
}

describe('wskazówki prologu', () => {
  it('poza prologiem nic nie podświetla ani nie blokuje', () => {
    const state = createInitialState(DEFAULT_BALANCE, SEED);
    expect(guideAction(state, false)).toBeNull();
    expect(tabLock(state, 'team')).toBeNull();
  });

  it('prowadzi od zlecenia przez przydział do tempa gry', () => {
    const player = prologuePlayer();
    expect(guideAction(player.state(), false)).toEqual({ kind: 'acceptOffer' });
    expect(tabLock(player.state(), 'team')).toBe(LOCKS.team);
    expect(tabLock(player.state(), 'finance')).toBe(LOCKS.finance);

    const project = player.acceptStarter();
    const owner = prologueOwner(player.state())?.id as EmployeeId;
    expect(guideAction(player.state(), false)).toEqual({ kind: 'assign', employeeIds: [owner] });
    expect(tabLock(player.state(), 'team')).toBeNull();

    player.assign(owner, project);
    expect(guideAction(player.state(), false)).toEqual({ kind: 'resume' });
    player.must({ type: 'SetSpeed', speed: 1 });
    expect(guideAction(player.state(), false)).toBeNull();
  });

  it('po końcu pracy wskazuje rozliczenie, a po nim następny dzień', () => {
    const player = prologuePlayer();
    const project = player.acceptStarter();
    player.assign(prologueOwner(player.state())?.id as EmployeeId, project);
    player.runUntil((state) => state.mission.timeInDayMs >= 120_000);
    // Bez przydziału wskazówka wraca do przydziału.
    player.assign(prologueOwner(player.state())?.id as EmployeeId, null);
    expect(guideAction(player.state(), false)?.kind).toBe('assign');
    player.assign(prologueOwner(player.state())?.id as EmployeeId, project);
    player.runUntil((state) => state.mission.phase === 'workEnded');
    // Oddanie jest możliwe także po końcu pracy, przed rozliczeniem.
    const action = guideAction(player.state(), false);
    if (action?.kind === 'deliver') {
      player.must({ type: 'DeliverProject', projectId: action.projectId });
    }
    expect(guideAction(player.state(), false)).toEqual({ kind: 'settle' });
    player.must({ type: 'SettleDay' });
    expect(guideAction(player.state(), false)).toEqual({ kind: 'nextDay' });
  });

  it('podświetla zakładkę tylko wtedy, gdy gracz jest gdzie indziej', () => {
    expect(navTarget({ kind: 'acceptOffer' }, 'office')).toBe('projects');
    expect(navTarget({ kind: 'acceptOffer' }, 'projects')).toBeNull();
    // Rekrutacja otwiera się z zakładki Zespół.
    expect(navTarget({ kind: 'hire' }, 'office')).toBe('team');
    expect(navTarget({ kind: 'hire' }, 'team')).toBeNull();
    expect(navTarget({ kind: 'resume' }, 'team')).toBe('office');
    expect(navTarget({ kind: 'nextDay' }, 'team')).toBeNull();
  });

  it('w trybie urządzania wskazuje zatwierdzenie zakupu', () => {
    const state = createPrologueState(DEFAULT_BALANCE, SEED);
    const buying = { ...state, prologue: { step: 'buyDesk' as const } };
    expect(guideAction(buying, false)).toEqual({ kind: 'buyDesk' });
    expect(guideAction(buying, true)).toEqual({ kind: 'placeDesk' });
    expect(tabLock(buying, 'furnish')).toBeNull();
    expect(tabLock(buying, 'recruit')).toBe(LOCKS.recruit);
  });
});
