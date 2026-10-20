import type { BalanceConfig } from '../domain/config';
import type { GameState } from '../domain/state';
import {
  commandHandlers,
  type Command,
  type CommandHandler,
  type CommandResult,
  type HandlerOutcome,
} from './commands';
import { advanceStep } from './step';
import { assertValidStepMs } from './time';

export type Listener = (state: GameState) => void;

export type Engine = {
  readonly config: BalanceConfig;
  getState(): GameState;
  // T:TIME-T06 — polecenia są wykonywane synchronicznie, w kolejności wywołań.
  dispatch(command: Command): CommandResult;
  // T:TIME-T01 — jeden stały krok czasu gry. Tempo decyduje o liczbie kroków, nie o ich długości.
  step(): void;
  subscribe(listener: Listener): () => void;
};

export type EngineOptions = {
  config: BalanceConfig;
  initialState: GameState;
};

export function createEngine({ config, initialState }: EngineOptions): Engine {
  assertValidStepMs(config.simulation.stepMs);
  let state = initialState;
  const listeners = new Set<Listener>();

  function commit(next: GameState): void {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener(state);
  }

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
      commit(outcome.state);
      return { ok: true };
    },
    step() {
      commit(advanceStep(state, config));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
