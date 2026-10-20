import type { BalanceConfig } from '../../domain/config';
import type { DayPhase, GameState, Speed } from '../../domain/state';

export type SetSpeedCommand = { type: 'SetSpeed'; speed: Speed };

export type Command = SetSpeedCommand;
export type CommandType = Command['type'];

// Odmowa niesie kod, nie tekst — komunikat dla gracza dobiera UI.
export type RejectionCode = 'missionEnded' | 'phaseNotAllowed' | 'invalidSpeed';

export type Rejection = { code: RejectionCode };

export type CommandResult = { ok: true } | { ok: false; rejection: Rejection };

export type HandlerOutcome = { ok: true; state: GameState } | { ok: false; rejection: Rejection };

export type CommandHandler<C extends Command> = {
  allowedPhases: readonly DayPhase[];
  // Handler nie mutuje stanu; zwraca nowy albo odmowę.
  execute(state: GameState, command: C, config: BalanceConfig): HandlerOutcome;
};

export function reject(code: RejectionCode): HandlerOutcome {
  return { ok: false, rejection: { code } };
}
