import { SPEEDS } from '../../domain/state';
import { reject, type CommandHandler, type SetSpeedCommand } from './types';

// TIME-02, TIME-08: tempo zmienia się tylko w trakcie dnia pracy; po jego końcu symulacja stoi.
export const setSpeed: CommandHandler<SetSpeedCommand> = {
  allowedPhases: ['working'],
  execute(state, command) {
    // Polecenia mogą pochodzić z niezweryfikowanego wejścia, więc walidujemy także w czasie wykonania.
    if (!(SPEEDS as readonly number[]).includes(command.speed)) return reject('invalidSpeed');
    if (state.mission.speed === command.speed) return { ok: true, state };
    return { ok: true, state: { ...state, mission: { ...state.mission, speed: command.speed } } };
  },
};
