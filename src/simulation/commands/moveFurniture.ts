import { interruptFurnitureUse, retargetEmployees, validatePlacement } from '../furniture';
import { reject, type CommandHandler, type MoveFurnitureCommand } from './types';

// OFF-06, OFF-07 (Z): bezpłatne przeniesienie z obrotem, wyłącznie na pauzie (edycja pauzuje
// symulację). Przypisanie biurka zostaje; pracownik idzie do nowej pozycji po wznowieniu.
// Korzystanie z przenoszonego mebla jest przerywane. Zablokowany dostęp uniemożliwia zatwierdzenie.
export const moveFurniture: CommandHandler<MoveFurnitureCommand> = {
  category: 'workDay',
  execute(state, command, config) {
    if (state.mission.speed !== 0) return reject('notPaused');
    const item = state.world.furniture[command.furnitureId];
    if (!item) return reject('unknownFurniture');
    const placement = validatePlacement(state, item.id, command.origin, command.rotation);
    if (placement) return reject(placement);

    const moved = {
      ...state,
      world: {
        ...state.world,
        furniture: {
          ...state.world.furniture,
          [item.id]: { ...item, origin: command.origin, rotation: command.rotation },
        },
      },
    };
    return { ok: true, state: retargetEmployees(interruptFurnitureUse(moved, item.id), config) };
  },
};
