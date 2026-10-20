import { assignDesk } from './assignDesk';
import { hireCandidate } from './hireCandidate';
import { moveFurniture } from './moveFurniture';
import { sellFurniture } from './sellFurniture';
import { setSpeed } from './setSpeed';
import { settleDay } from './settleDay';
import { startNextDay } from './startNextDay';
import type { Command, CommandHandler, CommandType } from './types';

export type * from './types';

type HandlerRegistry = { [T in CommandType]: CommandHandler<Extract<Command, { type: T }>> };

export const commandHandlers: HandlerRegistry = {
  SetSpeed: setSpeed,
  SettleDay: settleDay,
  StartNextDay: startNextDay,
  HireCandidate: hireCandidate,
  AssignDesk: assignDesk,
  MoveFurniture: moveFurniture,
  SellFurniture: sellFurniture,
};
