import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import type { ProjectId } from '../domain/contracts';
import type { GameState } from '../domain/state';
import { repairSize } from '../simulation/bugs';
import { activityOf } from '../simulation/needs';
import { createPlayer, type Player } from '../test/player';
import { OFFICE_LAYOUT } from '../world/officeLayout';
import type { ValidationContext } from './schema';
import { parseSnapshot, serializeSnapshot } from './snapshot';

// SH-043 (T:SAVE-T02–T05): zapis i wczytanie w trudnych momentach nie zmienia dalszej gry.
// Przebieg bez przerwy wyznacza pierwszy moment każdego stanu; potem ten sam przebieg z zapisem
// i wczytaniem w tym momencie musi dać identyczny stan końcowy (to samo RNG, te same polecenia).

const context: ValidationContext = { config: DEFAULT_BALANCE, layout: OFFICE_LAYOUT };
const SEED = 1;
const DAYS = 5;

function setup(player: Player): ProjectId {
  const projectId = player.acceptStarter();
  player.buyDesk();
  player.buyDesk();
  for (const [spec, seniority] of [
    ['frontend', 'junior'],
    ['backend', 'junior'],
    ['qa', 'senior'],
    ['pm', 'mid'],
  ] as const) {
    player.assign(player.hire(spec, seniority), projectId);
  }
  return projectId;
}

const CHECKPOINTS: Record<string, (state: GameState) => boolean> = {
  ruch: (s) => s.world.movement.agents.some((a) => a.move !== null),
  kolejka: (s) =>
    Object.values(s.staff.employees).some((e) => activityOf(s, e, false) === 'waitingForRest'),
  kawa: (s) => Object.values(s.staff.employees).some((e) => activityOf(s, e, false) === 'onCoffee'),
  naprawa: (s) =>
    Object.values(s.contracts.projects).some((p) =>
      p.fragments.some(
        (f) => f.repairProgress > 0 && f.repairProgress < repairSize(DEFAULT_BALANCE),
      ),
    ),
  decyzja: (s) => s.events.pending !== null,
  rozliczenie: (s) => s.mission.phase === 'settled',
};

function roundTrip(state: GameState): GameState {
  const meta = { gameBuildVersion: 'test', revision: 1, savedAt: '2026-10-22T00:00:00.000Z' };
  const saved = serializeSnapshot(state, meta, context);
  if (!saved.ok) throw new Error(saved.error.issues.join('\n'));
  const loaded = parseSnapshot(saved.json, context);
  if (!loaded.ok) throw new Error(loaded.error.issues.join('\n'));
  return loaded.envelope.state;
}

const finished = (player: Player) =>
  player.state().mission.status !== 'active' || player.state().mission.day > DAYS;

describe('odtworzenie pełnej misji (SH-043)', () => {
  // Przebieg referencyjny i pierwsze wystąpienie każdego stanu.
  const reference = createPlayer(DEFAULT_BALANCE, SEED);
  setup(reference);
  const firstTick: Record<string, number> = {};
  let ticks = 0;
  while (!finished(reference) && reference.tick()) {
    ticks++;
    for (const [name, matches] of Object.entries(CHECKPOINTS)) {
      if (firstTick[name] === undefined && matches(reference.state())) firstTick[name] = ticks;
    }
  }
  const finalState = reference.state();

  it('przebieg referencyjny obejmuje wszystkie trudne stany', () => {
    expect(Object.keys(firstTick).sort()).toEqual(Object.keys(CHECKPOINTS).sort());
  });

  it.each(Object.keys(CHECKPOINTS))('zapis i wczytanie w stanie: %s — ten sam wynik', (name) => {
    const at = firstTick[name];
    if (at === undefined) throw new Error(`Stan „${name}” nie wystąpił`);
    const first = createPlayer(DEFAULT_BALANCE, SEED);
    setup(first);
    for (let i = 0; i < at; i++) first.tick();
    expect(CHECKPOINTS[name]?.(first.state())).toBe(true);

    const loaded = roundTrip(first.state());
    expect(loaded).toEqual(first.state());
    const resumed = createPlayer(DEFAULT_BALANCE, SEED, loaded);
    while (!finished(resumed) && resumed.tick());
    expect(resumed.state()).toEqual(finalState);
  });

  it('bez podwójnych pensji i zaliczek; księga spójna z saldem', () => {
    const { ledger, cash, openingCash } = finalState.finance;
    const keys = ledger.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ledger.filter((e) => e.kind === 'advance')).toHaveLength(1);
    for (let day = 1; day <= DAYS; day++) {
      const wages = ledger.filter((e) => e.kind === 'wages' && e.day === day);
      expect(new Set(wages.map((e) => e.ref)).size).toBe(wages.length);
      expect(ledger.filter((e) => e.kind === 'upkeep' && e.day === day)).toHaveLength(1);
    }
    expect(openingCash + ledger.reduce((sum, e) => sum + e.amount, 0)).toBe(cash);
  });
});
