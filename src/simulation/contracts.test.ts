import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import {
  designImportance,
  fillBoard,
  maxOfferLevel,
  termsFromTemplate,
} from '../domain/contractBoard';
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

describe('katalog zleceń', () => {
  it('ma 19 spójnych szablonów na trzech poziomach', () => {
    expect(CONTRACT_TEMPLATES).toHaveLength(19);
    expect(new Set(CONTRACT_TEMPLATES.map((t) => t.id)).size).toBe(19);
    expect(new Set(CONTRACT_TEMPLATES.map((t) => t.level))).toEqual(new Set([1, 2, 3]));
    for (const template of CONTRACT_TEMPLATES) {
      const scopes = Object.entries(template.scopes);
      expect(scopes.length, template.id).toBeGreaterThan(0);
      for (const [specialization, points] of scopes) {
        expect(TECH_SPECIALIZATIONS).toContain(specialization);
        expect(points).toBeGreaterThan(0);
      }
      expect(template.design).toBeGreaterThanOrEqual(0);
      expect(template.reward).toBeGreaterThan(0);
      expect(template.advance).toBeGreaterThan(0);
      expect(template.advance).toBeLessThan(template.reward);
      expect(template.latePenaltyPerDay).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
    }
    expect(levelOf(STARTER_CONTRACT_ID)).toBe(1);
  });

  it('każdy szablon daje zakresy w pełnych fragmentach (BUG-01)', () => {
    for (const template of CONTRACT_TEMPLATES) {
      const terms = termsFromTemplate(template, DEFAULT_BALANCE);
      for (const points of [...Object.values(terms.scopes), terms.designScope]) {
        expect((points ?? 0) % DEFAULT_BALANCE.bugs.fragmentPoints, template.id).toBe(0);
      }
    }
  });

  it('znaczenie designu rośnie z zakresem, od 0 do 5', () => {
    expect([0, 5, 10, 15, 25, 35, 45, 90].map(designImportance)).toEqual([0, 1, 1, 2, 3, 4, 5, 5]);
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

  it('warunki oferty wynikają z katalogu i skali punktów (CON-02)', () => {
    const offer = createInitialState(DEFAULT_BALANCE, 1).contracts.offers[0];

    // Katalog: front end 25, backend 25, devops 5, grafik 15 pkt × 10 pp; zaliczka i kara z katalogu.
    expect(offer).toMatchObject({
      scopes: { frontend: 250, backend: 250, devops: 50 },
      deadlineDays: 10,
      reward: 21_000,
      advance: 10_500,
      latePenaltyPerDay: 200,
      designImportance: 2,
      designScope: 150,
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
