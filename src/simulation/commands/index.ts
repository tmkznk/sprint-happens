import { setSpeed } from './setSpeed';
import type { Command, CommandHandler, CommandType } from './types';

export type * from './types';

type HandlerRegistry = { [T in CommandType]: CommandHandler<Extract<Command, { type: T }>> };

export const commandHandlers: HandlerRegistry = {
  SetSpeed: setSpeed,
};
