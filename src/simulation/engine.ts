import type { BalanceConfig } from '../domain/config';
import type { DayPhase, GameState } from '../domain/state';
import {
  commandHandlers,
  type Command,
  type CommandHandler,
  type CommandResult,
  type HandlerOutcome,
} from './commands';
import { PHASES_BY_CATEGORY } from './commands/phases';
import { advanceStep } from './step';
import { assertValidStepMs } from './time';

export type Listener = (state: GameState) => void;
export type CommandListener = (command: Command, state: GameState) => void;

export type Engine = {
  readonly config: BalanceConfig;
  getState(): GameState;
  // T:TIME-T06 — polecenia są wykonywane synchronicznie, w kolejności wywołań.
  dispatch(command: Command): CommandResult;
  // T:TIME-T01 — jeden stały krok czasu gry. Tempo decyduje o liczbie kroków, nie o ich długości.
  step(): void;
  subscribe(listener: Listener): () => void;
  // Powiadamia o poleceniu, które zmieniło stan (np. dla autozapisu po ważnych działaniach).
  subscribeCommands(listener: CommandListener): () => void;
};

export type EngineOptions = {
  config: BalanceConfig;
  initialState: GameState;
};

export function createEngine({ config, initialState }: EngineOptions): Engine {
  assertValidStepMs(config.simulation.stepMs);
  let state = initialState;
  const listeners = new Set<Listener>();
  const commandListeners = new Set<CommandListener>();

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
    const allowedPhases: readonly DayPhase[] = PHASES_BY_CATEGORY[handler.category];
    if (!allowedPhases.includes(state.mission.phase)) {
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
      const changed = outcome.state !== state;
      commit(outcome.state);
      if (changed) for (const listener of commandListeners) listener(command, state);
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
    subscribeCommands(listener) {
      commandListeners.add(listener);
      return () => {
        commandListeners.delete(listener);
      };
    },
  };
}
