import type { BalanceConfig } from '../../domain/config';
import type { OfferId, ProjectId } from '../../domain/contracts';
import type { CandidateId, EmployeeId } from '../../domain/employees';
import type { FurnitureId, FurnitureType, Rotation } from '../../domain/furniture';
import type { GridPoint } from '../../domain/grid';
import type { GameState, Speed } from '../../domain/state';
import type { FinanceRejection } from '../finance';
import type { PlacementRejection } from '../furniture';
import type { CommandCategory } from './phases';

export type SetSpeedCommand = { type: 'SetSpeed'; speed: Speed };
export type SettleDayCommand = { type: 'SettleDay' };
export type StartNextDayCommand = { type: 'StartNextDay' };
export type HireCandidateCommand = { type: 'HireCandidate'; candidateId: CandidateId };
export type AssignDeskCommand = {
  type: 'AssignDesk';
  employeeId: EmployeeId;
  deskId: FurnitureId | null;
};
export type MoveFurnitureCommand = {
  type: 'MoveFurniture';
  furnitureId: FurnitureId;
  origin: GridPoint;
  rotation: Rotation;
};
export type SellFurnitureCommand = { type: 'SellFurniture'; furnitureId: FurnitureId };
export type AcceptOfferCommand = { type: 'AcceptOffer'; offerId: OfferId };
export type AssignProjectCommand = {
  type: 'AssignProject';
  employeeId: EmployeeId;
  projectId: ProjectId | null;
};
export type DeliverProjectCommand = { type: 'DeliverProject'; projectId: ProjectId };
export type FireEmployeeCommand = { type: 'FireEmployee'; employeeId: EmployeeId };
export type ResolveEventCommand = { type: 'ResolveEvent'; optionId: string };
export type BuyFurnitureCommand = {
  type: 'BuyFurniture';
  furnitureType: FurnitureType;
  origin: GridPoint;
  rotation: Rotation;
};

export type Command =
  | SetSpeedCommand
  | SettleDayCommand
  | StartNextDayCommand
  | HireCandidateCommand
  | AssignDeskCommand
  | MoveFurnitureCommand
  | SellFurnitureCommand
  | BuyFurnitureCommand
  | AcceptOfferCommand
  | AssignProjectCommand
  | DeliverProjectCommand
  | FireEmployeeCommand
  | ResolveEventCommand;
export type CommandType = Command['type'];

// Odmowa niesie kod, nie tekst — komunikat dla gracza dobiera UI.
export type RejectionCode =
  | 'missionEnded'
  | 'phaseNotAllowed'
  | 'invalidSpeed'
  | 'unknownCandidate'
  // Brak wolnego pola przy wejściu (biuro pełne postaci).
  | 'noRoomToEnter'
  | 'unknownOffer'
  | 'unknownProject'
  | 'projectClosed'
  | 'pmAlreadyAssigned'
  | 'projectIncomplete'
  | 'eventPending'
  | 'noPendingEvent'
  | 'unknownEventOption'
  | 'unknownEmployee'
  | 'unknownFurniture'
  | 'notADesk'
  | 'deskTaken'
  // OFF-07: edycja mebli wymaga pauzy.
  | 'notPaused'
  // Prolog: funkcja odblokowuje się na późniejszym etapie (albo po ukończeniu prologu).
  | 'prologueLocked'
  // OFF-05: niedozwolone ustawienie mebla.
  | PlacementRejection
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
