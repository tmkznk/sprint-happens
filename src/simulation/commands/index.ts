import { acceptOffer } from './acceptOffer';
import { assignDesk } from './assignDesk';
import { assignProject } from './assignProject';
import { buyFurniture } from './buyFurniture';
import { hireCandidate } from './hireCandidate';
import { moveFurniture } from './moveFurniture';
import { sellFurniture } from './sellFurniture';
import { setProjectPriority } from './setProjectPriority';
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
  BuyFurniture: buyFurniture,
  AcceptOffer: acceptOffer,
  AssignProject: assignProject,
  SetProjectPriority: setProjectPriority,
};
