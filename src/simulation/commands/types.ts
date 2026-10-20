import type { BalanceConfig } from '../../domain/config';
import type { CandidateId } from '../../domain/employees';
import type { GameState, Speed } from '../../domain/state';
import type { FinanceRejection } from '../finance';
import type { CommandCategory } from './phases';

export type SetSpeedCommand = { type: 'SetSpeed'; speed: Speed };
export type SettleDayCommand = { type: 'SettleDay' };
export type StartNextDayCommand = { type: 'StartNextDay' };
export type HireCandidateCommand = { type: 'HireCandidate'; candidateId: CandidateId };

export type Command =
  SetSpeedCommand | SettleDayCommand | StartNextDayCommand | HireCandidateCommand;
export type CommandType = Command['type'];

// Odmowa niesie kod, nie tekst — komunikat dla gracza dobiera UI.
export type RejectionCode =
  | 'missionEnded'
  | 'phaseNotAllowed'
  | 'invalidSpeed'
  | 'unknownCandidate'
  // Brak wolnego pola przy wejściu (biuro pełne postaci).
  | 'noRoomToEnter'
  // SH-027: operacje finansowe.
  | FinanceRejection;

export type Rejection = { code: RejectionCode };

export type CommandResult = { ok: true } | { ok: false; rejection: Rejection };

export type HandlerOutcome = { ok: true; state: GameState } | { ok: false; rejection: Rejection };

export type CommandHandler<C extends Command> = {
  // Kategoria wyznacza fazy dnia, w których polecenie jest dozwolone (phases.ts).
  category: CommandCategory;
  // Handler nie mutuje stanu; zwraca nowy albo odmowę.
  execute(state: GameState, command: C, config: BalanceConfig): HandlerOutcome;
};

export function reject(code: RejectionCode): HandlerOutcome {
  return { ok: false, rejection: { code } };
}
