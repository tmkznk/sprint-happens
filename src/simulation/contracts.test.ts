import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { fillBoard, maxOfferLevel } from '../domain/contractBoard';
import { CONTRACT_TEMPLATES, STARTER_CONTRACT_ID } from '../domain/content/contracts';
import { TECH_SPECIALIZATIONS, type OfferId } from '../domain/contracts';
import { createInitialState, type GameState } from '../domain/state';
import { deepFreeze } from '../test/deepFreeze';
import { testReport, testState } from '../test/engineFixture';
import { createEngine } from './engine';
import { recordOperation } from './finance';
import { DAY_LENGTH_MS } from './time';

function engineFor(state: GameState = testState()) {
  return createEngine({ config: DEFAULT_BALANCE, initialState: deepFreeze(state) });
}

const levelOf = (templateId: string) => CONTRACT_TEMPLATES.find((t) => t.id === templateId)?.level;

function toNextDay(state: GameState): GameState {
  const engine = engineFor({
    ...state,
    mission: {
      ...state.mission,
      phase: 'settled',
      speed: 0,
      timeInDayMs: DAY_LENGTH_MS,
      report: testReport(state.mission.day, state.finance.cash),
    },
  });
  expect(engine.dispatch({ type: 'StartNextDay' })).toEqual({ ok: true });
  return engine.getState();
}

describe('pula kontraktów (SH-032 A4, B8)', () => {
  it('ma 12 spójnych szablonów na trzech poziomach', () => {
    expect(CONTRACT_TEMPLATES).toHaveLength(12);
    expect(new Set(CONTRACT_TEMPLATES.map((t) => t.id)).size).toBe(12);
    expect(new Set(CONTRACT_TEMPLATES.map((t) => t.level))).toEqual(new Set([1, 2, 3]));
    for (const template of CONTRACT_TEMPLATES) {
      const scopes = Object.entries(template.scopes);
      expect(scopes.length, template.id).toBeGreaterThan(0);
      for (const [specialization, points] of scopes) {
        expect(TECH_SPECIALIZATIONS).toContain(specialization);
        expect(points % 10, template.id).toBe(0);
        expect(points).toBeGreaterThan(0);
      }
      expect(template.designImportance).toBeGreaterThanOrEqual(0);
      expect(template.designImportance).toBeLessThanOrEqual(5);
      expect(template.reward).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
    }
    expect(levelOf(STARTER_CONTRACT_ID)).toBe(1);
  });
});

describe('tablica zleceń (CON-01, SH-032 A3, A5)', () => {
  it('startuje z trzema ofertami poziomu 1, w tym gwarantowanym kontraktem startowym', () => {
    for (const seed of [1, 2, 3, 42, 999]) {
      const { offers } = createInitialState(DEFAULT_BALANCE, seed).contracts;
      expect(offers).toHaveLength(3);
      expect(offers[0]?.templateId).toBe(STARTER_CONTRACT_ID);
      expect(new Set(offers.map((o) => o.templateId)).size).toBe(3);
      expect(offers.every((o) => levelOf(o.templateId) === 1)).toBe(true);
    }
  });

  it('warunki oferty wynikają z szablonu i konfiguracji (CON-02, B5, B6)', () => {
    const offer = createInitialState(DEFAULT_BALANCE, 1).contracts.offers[0];

    expect(offer).toMatchObject({
      scopes: { frontend: 60, backend: 40 },
      deadlineDays: 3,
      reward: 7_000,
      advance: 2_100,
      latePenaltyPerDay: 700,
      designImportance: 1,
      designScope: 20,
    });
  });

  it('poziom ofert rośnie z liczbą oddanych projektów', () => {
    expect([0, 1, 2, 3, 6].map(maxOfferLevel)).toEqual([1, 2, 2, 3, 3]);
  });

  it('bez oddanych projektów nigdy nie losuje ofert powyżej poziomu 1', () => {
    for (let seed = 0; seed < 50; seed++) {
      const board = fillBoard({ offers: [], ids: {}, rng: seed }, 0, DEFAULT_BALANCE);
      expect(board.offers.every((o) => levelOf(o.templateId) === 1)).toBe(true);
    }
  });

  it('po oddaniach losuje także wyższe poziomy, bez powtórzeń na tablicy', () => {
    const levels = new Set<number | undefined>();
    for (let seed = 0; seed < 50; seed++) {
      const board = fillBoard({ offers: [], ids: {}, rng: seed }, 3, DEFAULT_BALANCE);
      expect(new Set(board.offers.map((o) => o.templateId)).size).toBe(3);
      for (const offer of board.offers) levels.add(levelOf(offer.templateId));
    }
    expect(levels).toEqual(new Set([1, 2, 3]));
  });
});

describe('AcceptOffer (CON-03, FIN-01, TIME-08)', () => {
  it('przyjęcie bez zespołu: projekt z terminem D+N i jedną zaliczką; oferta znika', () => {
    const engine = engineFor(testState({ day: 2 }));
    const offer = engine.getState().contracts.offers[0];
    if (!offer) throw new Error('brak oferty');
    const cash = engine.getState().finance.cash;

    expect(engine.dispatch({ type: 'AcceptOffer', offerId: offer.id })).toEqual({ ok: true });
    const state = engine.getState();
    expect(Object.keys(state.staff.employees)).toHaveLength(0);
    expect(state.contracts.offers.map((o) => o.id)).not.toContain(offer.id);
    expect(state.contracts.offers).toHaveLength(2);
    expect(Object.values(state.contracts.projects)).toEqual([
      expect.objectContaining({
        id: 'project-1',
        templateId: offer.templateId,
        acceptedOnDay: 2,
        deadlineDay: 2 + offer.deadlineDays,
        status: 'active',
      }),
    ]);
    expect(state.finance.cash).toBe(cash + offer.advance);
    expect(state.finance.ledger.filter((e) => e.kind === 'advance')).toHaveLength(1);
    expect(engine.dispatch({ type: 'AcceptOffer', offerId: offer.id })).toEqual({
      ok: false,
      rejection: { code: 'unknownOffer' },
    });
  });

  it('pozwala na równoległe kontrakty i przyjęcie przy długu (CON-03, FIN-06)', () => {
    const debt = recordOperation(testState(), {
      key: 'event:debt',
      kind: 'event',
      amount: -20_000,
    });
    if (!debt.ok) throw new Error('setup');
    const engine = engineFor(debt.state);
    for (const offer of engine.getState().contracts.offers) {
      expect(engine.dispatch({ type: 'AcceptOffer', offerId: offer.id }).ok).toBe(true);
    }

    expect(Object.keys(engine.getState().contracts.projects)).toHaveLength(3);
    expect(engine.getState().contracts.offers).toHaveLength(0);
  });

  it('po zakończeniu pracy nie można przyjmować kontraktów (TIME-08)', () => {
    const engine = engineFor(testState({ phase: 'workEnded', timeInDayMs: DAY_LENGTH_MS }));
    const offerId = engine.getState().contracts.offers[0]?.id ?? ('offer-1' as OfferId);

    expect(engine.dispatch({ type: 'AcceptOffer', offerId })).toEqual({
      ok: false,
      rejection: { code: 'phaseNotAllowed' },
    });
  });

  it('luka po przyjętej ofercie uzupełnia się następnego dnia; pozostałe oferty zostają', () => {
    const engine = engineFor();
    const [accepted, ...rest] = engine.getState().contracts.offers;
    if (!accepted) throw new Error('brak oferty');
    engine.dispatch({ type: 'AcceptOffer', offerId: accepted.id });

    const next = toNextDay(engine.getState());

    expect(next.contracts.offers).toHaveLength(3);
    expect(next.contracts.offers.slice(0, 2).map((o) => o.id)).toEqual(rest.map((o) => o.id));
    expect(new Set(next.contracts.offers.map((o) => o.templateId)).size).toBe(3);
  });

  it('nieprzyjęte oferty nie wygasają (SH-032 A3c)', () => {
    let state = testState();
    const ids = state.contracts.offers.map((o) => o.id);
    for (let i = 0; i < 3; i++) state = toNextDay(state);

    expect(state.contracts.offers.map((o) => o.id)).toEqual(ids);
  });
});
