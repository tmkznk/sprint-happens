import { personById, type PersonId } from '../domain/content/people';

// Dymek z imieniem nad zaznaczoną postacią: treść i wymiary (px świata). Rysowanie — characterSprites.
export const NAME_TAG = {
  fontSize: 10.5,
  paddingX: 6,
  height: 17,
  // Dzióbek wskazujący głowę.
  tailWidth: 8,
  tailHeight: 4.5,
} as const;

export function firstNameOf(personId: PersonId): string {
  return personById(personId)?.name.split(' ')[0] ?? '';
}

export function nameTagSize(textWidth: number): { width: number; height: number } {
  return {
    width: Math.ceil(textWidth + NAME_TAG.paddingX * 2),
    height: Math.ceil(NAME_TAG.height + NAME_TAG.tailHeight),
  };
}
