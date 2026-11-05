import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { createInitialState, type GameState } from '../domain/state';
import type { Command } from '../simulation/commands';
import { createEngine, type CommandListener } from '../simulation/engine';
import {
  attachAnalytics,
  createAnalyticsSender,
  eventsFor,
  type AnalyticsEvent,
} from './analytics';

const SPEED: Command = { type: 'SetSpeed', speed: 0 };
const HIRE = { type: 'HireCandidate', candidateId: 'c' } as unknown as Command;
const mission = (status: 'active' | 'won' | 'bankrupt') => ({ prologueStep: null, status });
const prologue = (prologueStep: 'hireHelper' | 'deliverSecond' | 'finished') => ({
  prologueStep,
  status: 'active' as const,
});
const paths = (events: AnalyticsEvent[]) => events.map((event) => event.path);

describe('eventsFor', () => {
  it('liczy każde zatrudnienie w misji', () => {
    const events = eventsFor(HIRE, mission('active'), mission('active'));
    expect(events).toEqual([
      { path: 'hire-employee', title: 'Zatrudniono pracownika', countEach: true },
    ]);
  });

  it('nie liczy obowiązkowego zatrudnienia w prologu', () => {
    expect(eventsFor(HIRE, prologue('hireHelper'), prologue('hireHelper'))).toEqual([]);
  });

  it('zgłasza koniec prologu tylko przy przejściu', () => {
    const finished = prologue('finished');
    expect(paths(eventsFor(SPEED, prologue('deliverSecond'), finished))).toEqual([
      'prologue-finished',
    ]);
    expect(eventsFor(SPEED, finished, finished)).toEqual([]);
  });

  it('zgłasza wynik misji tylko przy zmianie statusu', () => {
    expect(paths(eventsFor(SPEED, mission('active'), mission('won')))).toEqual(['mission-won']);
    expect(paths(eventsFor(SPEED, mission('active'), mission('bankrupt')))).toEqual([
      'mission-bankrupt',
    ]);
    expect(eventsFor(SPEED, mission('won'), mission('won'))).toEqual([]);
  });

  it('nie zgłasza wyniku prologu jako wyniku misji', () => {
    const before = prologue('hireHelper');
    expect(eventsFor(SPEED, before, { ...before, status: 'bankrupt' })).toEqual([]);
  });
});

describe('attachAnalytics', () => {
  const state = createInitialState(DEFAULT_BALANCE, 1);

  it('porównuje kolejne polecenia i przestaje wysyłać po odpięciu', () => {
    let listener: CommandListener = () => undefined;
    const stop = vi.fn();
    const send = vi.fn();
    const detach = attachAnalytics(
      {
        getState: () => state,
        subscribeCommands: (next) => {
          listener = next;
          return stop;
        },
      },
      send,
    );
    const won: GameState = { ...state, mission: { ...state.mission, status: 'won' } };
    listener(SPEED, won);
    listener(SPEED, won);
    expect(paths(send.mock.calls.map(([event]) => event as AnalyticsEvent))).toEqual([
      'mission-won',
    ]);
    detach();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('wczytana ukończona misja nie jest liczona ponownie', () => {
    const won: GameState = { ...state, mission: { ...state.mission, status: 'won' } };
    let listener: CommandListener = () => undefined;
    const send = vi.fn();
    attachAnalytics(
      {
        getState: () => won,
        subscribeCommands: (next) => {
          listener = next;
          return () => undefined;
        },
      },
      send,
    );
    listener(SPEED, won);
    expect(send).not.toHaveBeenCalled();
  });

  it('odrzucone polecenie nie jest liczone', () => {
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: state });
    const send = vi.fn();
    attachAnalytics(engine, send);
    expect(engine.dispatch(HIRE).ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('createAnalyticsSender', () => {
  const EVENT: AnalyticsEvent = { path: 'x', title: 'X' };

  it('bez startu pomija zdarzenia', () => {
    const sender = createAnalyticsSender();
    sender.send(EVENT);
    const target = vi.fn();
    sender.ready(target);
    expect(target).not.toHaveBeenCalled();
  });

  it('wysyła zdarzenia sprzed załadowania skryptu, potem od razu', () => {
    const sender = createAnalyticsSender();
    const target = vi.fn();
    sender.start();
    sender.send(EVENT);
    expect(target).not.toHaveBeenCalled();
    sender.ready(target);
    sender.send(EVENT);
    expect(target).toHaveBeenCalledTimes(2);
  });

  it('ogranicza kolejkę i porzuca ją, gdy skrypt jest niedostępny', () => {
    const sender = createAnalyticsSender();
    const target = vi.fn();
    sender.start();
    for (let i = 0; i < 50; i += 1) sender.send(EVENT);
    sender.ready(target);
    expect(target).toHaveBeenCalledTimes(20);

    const blocked = createAnalyticsSender();
    const unused = vi.fn();
    blocked.start();
    blocked.send(EVENT);
    blocked.stop();
    blocked.send(EVENT);
    blocked.ready(unused);
    expect(unused).not.toHaveBeenCalled();
  });

  it('błąd statystyk nie przerywa polecenia gracza', () => {
    const sender = createAnalyticsSender();
    sender.start();
    sender.ready(() => {
      throw new Error('bloker');
    });
    expect(() => {
      sender.send(EVENT);
    }).not.toThrow();
  });
});
