import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import {
  PROLOGUE_FIRST_CONTRACT,
  PROLOGUE_HELPER_ID,
  PROLOGUE_OWNER,
  PROLOGUE_SECOND_CONTRACT,
  PROLOGUE_STARTING_CASH,
} from '../domain/content/prologue';
import type { ProjectId } from '../domain/contracts';
import type { CandidateId, EmployeeId } from '../domain/employees';
import type { GameState } from '../domain/state';
import { createPlayer, type Player } from '../test/player';
import { createPrologueState, prologueHelper, prologueOwner, prologueProject } from './prologue';

const SEED = 20261027;

function prologuePlayer(): Player {
  return createPlayer(DEFAULT_BALANCE, SEED, createPrologueState(DEFAULT_BALANCE, SEED));
}

const step = (player: Player) => player.state().prologue?.step;
const owner = (player: Player) => prologueOwner(player.state())?.id as EmployeeId;

// Dni pracy aż do spełnienia warunku (rozliczenie i następny dzień po drodze).
function playUntil(player: Player, done: (state: GameState) => boolean) {
  for (let day = 0; day < 10 && !done(player.state()); day++) {
    if (player.runUntil(done)) return;
    player.must({ type: 'SettleDay' });
    // Saldo po rozliczeniu nie spada poniżej zera — prolog nie testuje okresu ratunkowego.
    expect(player.state().mission.report?.cashAfterSettlement).toBeGreaterThanOrEqual(0);
    player.must({ type: 'StartNextDay' });
  }
  expect(done(player.state())).toBe(true);
}

const readyFor = (template: typeof PROLOGUE_FIRST_CONTRACT) => (state: GameState) => {
  const project = prologueProject(state, template);
  return (
    project !== undefined &&
    Object.entries(project.scopes).every(
      ([spec, scope]) => (project.progress[spec as 'frontend'] ?? 0) >= scope * 1_000_000,
    )
  );
};

describe('prolog', () => {
  it('startuje z Januszem przy jedynym stanowisku, jednym zleceniem i jednym kandydatem', () => {
    const state = createPrologueState(DEFAULT_BALANCE, SEED);
    expect(state.prologue).toEqual({ step: 'acceptFirst' });
    expect(state.finance.cash).toBe(PROLOGUE_STARTING_CASH);
    const team = Object.values(state.staff.employees);
    expect(team.map((e) => e.personId)).toEqual([PROLOGUE_OWNER.id]);
    expect(team[0]?.deskId).not.toBeNull();
    expect(state.finance.wagesDueToday[team[0]?.id ?? '']).toBe(team[0]?.dailyWage);
    expect(Object.values(state.world.furniture).filter((f) => f.type === 'desk')).toHaveLength(1);
    expect(state.contracts.offers.map((o) => o.templateId)).toEqual([PROLOGUE_FIRST_CONTRACT.id]);
    expect(state.staff.candidates.map((c) => c.personId)).toEqual([PROLOGUE_HELPER_ID]);
    expect(state.world.movement.agents).toHaveLength(1);
  });

  it('blokuje funkcje, do których prolog jeszcze nie doszedł', () => {
    const player = prologuePlayer();
    const locked = { ok: false, rejection: { code: 'prologueLocked' } };
    const candidate = player.state().staff.candidates[0];
    const desk = Object.values(player.state().world.furniture)[0];
    if (!candidate || !desk) throw new Error('Brak danych startu');
    expect(player.engine.dispatch({ type: 'SetSpeed', speed: 1 })).toEqual(locked);
    expect(player.engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id })).toEqual(
      locked,
    );
    expect(
      player.engine.dispatch({
        type: 'BuyFurniture',
        furnitureType: 'desk',
        origin: { x: 4, y: 8 },
        rotation: 0,
      }),
    ).toEqual(locked);
    expect(player.engine.dispatch({ type: 'SellFurniture', furnitureId: desk.id })).toEqual(locked);
    expect(player.engine.dispatch({ type: 'FireEmployee', employeeId: owner(player) })).toEqual(
      locked,
    );
    // Odrzucone polecenia nie zmieniają stanu; pauza jest zawsze dostępna.
    expect(player.state().prologue?.step).toBe('acceptFirst');
    expect(player.engine.dispatch({ type: 'SetSpeed', speed: 0 })).toEqual({ ok: true });
  });

  it('prowadzi przez pięć celów na obecnych zasadach gry', () => {
    const player = prologuePlayer();

    // Cel 1 i 2: przyjęcie i przypisanie Janusza; potem tempo gry jest dostępne.
    const first = player.acceptStarter();
    expect(step(player)).toBe('assignOwner');
    expect(player.state().contracts.offers).toEqual([]);
    player.assign(owner(player), first);
    expect(step(player)).toBe('deliverFirst');

    // Realizacja i rozliczenie pierwszego projektu (Janusz pracuje sam).
    playUntil(player, readyFor(PROLOGUE_FIRST_CONTRACT));
    // Następny dzień nie dokłada losowych zleceń ani zdarzeń.
    expect(player.state().contracts.offers).toEqual([]);
    expect(player.state().events.scheduledAtMs).toBeNull();
    expect(
      player.engine.dispatch({
        type: 'HireCandidate',
        candidateId: player.state().staff.candidates[0]?.id as CandidateId,
      }),
    ).toMatchObject({ rejection: { code: 'prologueLocked' } });
    player.must({ type: 'DeliverProject', projectId: first });
    expect(step(player)).toBe('buyDesk');

    // Cel 3: ze sklepu tylko stanowisko pracy.
    player.must({ type: 'SetSpeed', speed: 0 });
    expect(
      player.engine.dispatch({
        type: 'BuyFurniture',
        furnitureType: 'plant',
        origin: { x: 4, y: 8 },
        rotation: 0,
      }),
    ).toMatchObject({ rejection: { code: 'prologueLocked' } });
    player.buyDesk();
    expect(step(player)).toBe('hireHelper');

    // Cel 4: jedyny kandydat dostaje wolne biurko.
    const helper = player.hire('backend', 'mid');
    expect(prologueHelper(player.state())?.deskId).not.toBeNull();
    expect(player.state().staff.candidates).toEqual([]);
    expect(step(player)).toBe('acceptSecond');
    expect(player.state().contracts.offers.map((o) => o.templateId)).toEqual([
      PROLOGUE_SECOND_CONTRACT.id,
    ]);

    // Cel 5: drugie zlecenie, przydział obu osób, ukończenie.
    const second = player.acceptStarter() as ProjectId;
    expect(step(player)).toBe('assignTeam');
    player.assign(helper, second);
    expect(step(player)).toBe('assignTeam');
    player.assign(owner(player), second);
    expect(step(player)).toBe('deliverSecond');
    playUntil(player, readyFor(PROLOGUE_SECOND_CONTRACT));
    expect(prologueProject(player.state(), PROLOGUE_SECOND_CONTRACT)?.progress.backend).toBe(
      60 * 1_000_000,
    );
    player.must({ type: 'DeliverProject', projectId: second });

    // Finał: gra zatrzymana, dalej tylko pauza.
    const state = player.state();
    expect(state.prologue?.step).toBe('finished');
    expect(state.mission.speed).toBe(0);
    expect(state.mission.status).toBe('active');
    expect(state.finance.cash).toBeGreaterThan(0);
    expect(player.engine.dispatch({ type: 'SetSpeed', speed: 1 })).toMatchObject({
      rejection: { code: 'prologueLocked' },
    });
  });
});
