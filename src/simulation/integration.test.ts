import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from '../domain/config';
import type { Project, ProjectId } from '../domain/contracts';
import type { GameState } from '../domain/state';
import { createPlayer } from '../test/player';
import { isDetected } from './bugs';
import { activityOf } from './needs';
import { detectedBugCount } from './qa';
import { RESCUE_DAYS } from './settlement';
import { pmBonusPermille } from './work';

// SH-042 (F:16, T:10): współdziałanie reguł w pełnym silniku — polecenia gracza i kroki
// symulacji, bez wywoływania funkcji systemów z pominięciem silnika.

const project = (state: GameState, id: ProjectId) => state.contracts.projects[id] as Project;

// Zespół na projekt startowy: FE i BE junior (dużo błędów), QA senior, PM senior; 4 biurka.
function team(config: BalanceConfig = DEFAULT_BALANCE, seed?: number) {
  const player = createPlayer(config, seed);
  const projectId = player.acceptStarter();
  player.buyDesk();
  player.buyDesk();
  const frontend = player.hire('frontend', 'junior');
  const backend = player.hire('backend', 'junior');
  const qa = player.hire('qa', 'senior');
  const pm = player.hire('pm', 'senior');
  for (const id of [frontend, backend, qa, pm]) player.assign(id, projectId);
  return { player, projectId, frontend, backend, qa, pm };
}

describe('od zatrudnienia do oddania (SH-042 kryterium 1)', () => {
  it('przerwy, wykrycie błędów, automatyczne naprawy, PM bez energii, oddanie', () => {
    const { player, projectId, frontend, backend, pm } = team();
    const seen = { rest: false, detected: false, repair: false, pmAtZero: false };

    const observe = (state: GameState) => {
      for (const employee of Object.values(state.staff.employees)) {
        const activity = activityOf(state, employee, false);
        if (activity === 'onCoffee' || activity === 'onSofa') seen.rest = true;
      }
      const p = project(state, projectId);
      if (detectedBugCount(p, player.config) > 0) seen.detected = true;
      if (p.fragments.some((f) => f.repairProgress > 0)) seen.repair = true;
      return false;
    };

    // Praca do ukończenia funkcji (z obserwacją przerw i testów), dzień po dniu.
    const featuresDone = (s: GameState) => {
      const p = project(s, projectId);
      return (p.progress.frontend ?? 0) >= 60 * 1e6 && (p.progress.backend ?? 0) >= 40 * 1e6;
    };
    for (let day = 0; day < 6 && !featuresDone(player.state()); day++) {
      player.runUntil((s) => observe(s) || featuresDone(s) || s.mission.phase !== 'working');
      if (!featuresDone(player.state())) player.finishDay();
    }
    expect(featuresDone(player.state())).toBe(true);

    // PROJ-11: PM z energią 0 (np. czeka na kanapę) nadal daje premię.
    const drained = player.state();
    const pmEmployee = drained.staff.employees[pm];
    if (!pmEmployee) throw new Error('brak PM-a');
    const zero = createPlayer(player.config, undefined, {
      ...drained,
      staff: {
        ...drained.staff,
        employees: { ...drained.staff.employees, [pm]: { ...pmEmployee, energy: 0 } },
      },
    });
    seen.pmAtZero = pmBonusPermille(zero.state(), projectId, zero.config) === 200;

    // Po funkcjach: QA kończy testy, developerzy sami naprawiają wykryte błędy.
    player.runUntil((s) => {
      observe(s);
      const p = project(s, projectId);
      return (
        p.fragments.every((f) => f.testProgress >= 10 * 1e6) &&
        detectedBugCount(p, player.config) === 0
      );
    }, 40_000);
    player.runUntil((s) => s.mission.phase === 'workEnded');

    expect(seen).toEqual({ rest: true, detected: true, repair: true, pmAtZero: true });
    const before = player.state();
    const p = project(before, projectId);
    expect(p.fragments.filter((f) => f.hasBug && isDetected(f, player.config))).not.toHaveLength(0);

    player.must({ type: 'DeliverProject', projectId });
    const after = player.state();
    const report = project(after, projectId).delivery;
    expect(report?.remainingBugs).toBe(0);
    expect(report?.qualityPermille).toBe(1000);
    expect(after.finance.ledger.filter((e) => e.key === `payment:${projectId}`)).toHaveLength(1);
    for (const id of [frontend, backend, pm]) {
      expect(after.staff.employees[id]?.projectId).toBeNull();
    }
  });
});

describe('granice (SH-042 kryterium 2)', () => {
  it('oddanie po pracy w dniu terminu jest terminowe; dzień później — jedna kara', () => {
    const run = (extraDays: number) => {
      const player = createPlayer();
      const projectId = player.acceptStarter();
      const fe = player.hire('frontend', 'senior');
      const be = player.hire('backend', 'senior');
      player.assign(fe, projectId);
      player.assign(be, projectId);
      const deadline = project(player.state(), projectId).deadlineDay;
      while (player.state().mission.day < deadline + extraDays) player.finishDay();
      player.runUntil((s) => s.mission.phase === 'workEnded');
      expect(player.state().mission.phase).toBe('workEnded');
      player.must({ type: 'DeliverProject', projectId });
      return project(player.state(), projectId).delivery;
    };
    expect(run(0)).toMatchObject({ daysLate: 0, penalty: 0 });
    const late = run(1);
    expect(late).toMatchObject({ daysLate: 1, penalty: 700 });
  });

  it('zwolniony dostaje pełną dniówkę za dzień zwolnienia i nic za kolejne', () => {
    const player = createPlayer();
    const id = player.hire('backend', 'mid');
    player.runUntil((s) => s.mission.timeInDayMs >= 60_000);
    player.must({ type: 'FireEmployee', employeeId: id });
    player.finishDay();
    player.finishDay();
    const wages = player.state().finance.ledger.filter((e) => e.kind === 'wages' && e.ref === id);
    expect(wages).toEqual([expect.objectContaining({ day: 1, amount: -500 })]);
  });

  it('okres ratunkowy: dług blokuje zatrudnianie; trzy dni bez poprawy — bankructwo', () => {
    const config = {
      ...DEFAULT_BALANCE,
      mission: { ...DEFAULT_BALANCE.mission, startingCash: 1_500 },
    };
    const player = createPlayer(config);
    player.hire('frontend', 'senior');
    player.finishDay();
    const firstDebtDay = 1;
    expect(player.state().finance.rescueDeadlineDay).toBe(firstDebtDay + RESCUE_DAYS);
    const rejected = player.engine.dispatch({
      type: 'HireCandidate',
      candidateId: player.state().staff.candidates[0]?.id as never,
    });
    expect(rejected.ok).toBe(false);
    while (player.state().mission.status === 'active') player.finishDay();
    expect(player.state().mission.status).toBe('bankrupt');
    expect(player.state().mission.day).toBe(firstDebtDay + RESCUE_DAYS);
  });

  it('powrót do salda ≥ 0 kasuje okres ratunkowy (oddanie projektu w długu)', () => {
    const config = { ...DEFAULT_BALANCE, mission: { ...DEFAULT_BALANCE.mission, startingCash: 0 } };
    const player = createPlayer(config);
    const projectId = player.acceptStarter();
    const fe = player.hire('frontend', 'senior');
    const be = player.hire('backend', 'senior');
    player.assign(fe, projectId);
    player.assign(be, projectId);
    player.finishDay();
    const afterDayOne = player.state().finance;
    if (afterDayOne.cash < 0) expect(afterDayOne.rescueDeadlineDay).not.toBeNull();
    player.runUntil((s) => {
      const p = project(s, projectId);
      return (p.progress.frontend ?? 0) >= 60e6 && (p.progress.backend ?? 0) >= 40e6;
    });
    player.must({ type: 'DeliverProject', projectId });
    player.finishDay();
    expect(player.state().finance.cash).toBeGreaterThanOrEqual(0);
    expect(player.state().finance.rescueDeadlineDay).toBeNull();
    expect(player.state().mission.status).toBe('active');
  });
});

describe('koniec misji i zdarzenia (SH-042 kryterium 3)', () => {
  const easyWin = {
    ...DEFAULT_BALANCE,
    mission: {
      ...DEFAULT_BALANCE.mission,
      victory: { deliveredProjects: 1, cash: 17_000, reputation: 50 },
    },
  };

  it('zwycięstwo dopiero w rozliczeniu, po kosztach i przy wszystkich progach', () => {
    const player = createPlayer(easyWin);
    const projectId = player.acceptStarter();
    const fe = player.hire('frontend', 'senior');
    const be = player.hire('backend', 'senior');
    player.assign(fe, projectId);
    player.assign(be, projectId);
    player.runUntil((s) => {
      const p = project(s, projectId);
      return (p.progress.frontend ?? 0) >= 60e6 && (p.progress.backend ?? 0) >= 40e6;
    });
    player.must({ type: 'DeliverProject', projectId });
    // Progi spełnione w trakcie dnia — gra trwa do rozliczenia.
    expect(player.state().finance.cash).toBeGreaterThanOrEqual(17_000);
    expect(player.state().mission.status).toBe('active');
    player.runUntil((s) => s.mission.phase === 'workEnded');
    player.must({ type: 'SettleDay' });
    const settled = player.state();
    const expected = settled.finance.cash >= 17_000 && settled.mission.reputation >= 50;
    expect(settled.mission.status).toBe(expected ? 'won' : 'active');
    expect(expected).toBe(true);
    expect(player.engine.dispatch({ type: 'StartNextDay' })).toEqual({
      ok: false,
      rejection: { code: 'missionEnded' },
    });
  });

  it('reputacja zero sama nie kończy misji', () => {
    const player = createPlayer();
    const zero = createPlayer(DEFAULT_BALANCE, undefined, {
      ...player.state(),
      mission: { ...player.state().mission, reputation: 0 },
    });
    zero.finishDay();
    zero.finishDay();
    expect(zero.state().mission.status).toBe('active');
    expect(zero.state().mission.day).toBe(3);
  });

  it('zdarzenie stosuje skutek dokładnie raz', () => {
    const player = createPlayer();
    const state = player.state();
    const withEvent = createPlayer(DEFAULT_BALANCE, undefined, {
      ...state,
      ids: { ...state.ids, event: 1 },
      events: {
        ...state.events,
        pending: {
          instanceId: 'event-1',
          templateId: 'framework-conference',
          projectId: null,
          resumeSpeed: 1,
        },
      },
    });
    const cash = withEvent.state().finance.cash;
    withEvent.must({ type: 'ResolveEvent', optionId: 'send' });
    expect(withEvent.engine.dispatch({ type: 'ResolveEvent', optionId: 'send' }).ok).toBe(false);
    withEvent.finishDay();
    expect(withEvent.state().finance.ledger.filter((e) => e.kind === 'event')).toHaveLength(1);
    expect(withEvent.state().finance.cash).toBeLessThan(cash);
  });
});
