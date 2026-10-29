import { SPEEDS } from '../../domain/state';
import { reject, type CommandHandler, type SetSpeedCommand } from './types';

// TIME-02, TIME-08: tempo zmienia się w przyjściu, dniu pracy i wyjściu; po wyjściu symulacja stoi.
export const setSpeed: CommandHandler<SetSpeedCommand> = {
  category: 'speed',
  execute(state, command) {
    // Polecenia mogą pochodzić z niezweryfikowanego wejścia, więc walidujemy także w czasie wykonania.
    if (!(SPEEDS as readonly number[]).includes(command.speed)) return reject('invalidSpeed');
    // EVT-02: zdarzenie decyzyjne trzyma grę na pauzie do wyboru odpowiedzi.
    if (state.events.pending && command.speed !== 0) return reject('eventPending');
    if (state.mission.speed === command.speed) return { ok: true, state };
    return { ok: true, state: { ...state, mission: { ...state.mission, speed: command.speed } } };
  },
};
