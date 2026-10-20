import type { BalanceConfig } from '../domain/config';
import { createInitialState, type GameState } from '../domain/state';
import {
  commandHandlers,
  type Command,
  type CommandHandler,
  type CommandResult,
  type HandlerOutcome,
} from './commands';

export type Listener = (state: GameState) => void;

export type Engine = {
  readonly config: BalanceConfig;
  getState(): GameState;
  // T:TIME-T06 — polecenia są wykonywane synchronicznie, w kolejności wywołań.
  dispatch(command: Command): CommandResult;
  subscribe(listener: Listener): () => void;
};

export type EngineOptions = {
  config: BalanceConfig;
  initialState?: GameState;
};

export function createEngine({ config, initialState }: EngineOptions): Engine {
  let state = initialState ?? createInitialState(config);
  const listeners = new Set<Listener>();

  function execute(command: Command): HandlerOutcome {
    if (state.mission.status !== 'active') {
      return { ok: false, rejection: { code: 'missionEnded' } };
    }
    const handler = commandHandlers[command.type] as CommandHandler<Command>;
    if (!handler.allowedPhases.includes(state.mission.phase)) {
      return { ok: false, rejection: { code: 'phaseNotAllowed' } };
    }
    return handler.execute(state, command, config);
  }

  return {
    config,
    getState: () => state,
    dispatch(command) {
      const outcome = execute(command);
      if (!outcome.ok) return outcome;
      if (outcome.state !== state) {
        state = outcome.state;
        for (const listener of listeners) listener(state);
      }
      return { ok: true };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
