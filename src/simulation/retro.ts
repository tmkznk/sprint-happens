import type { BalanceConfig } from '../domain/config';
import { RETRO_CARDS, retroCardById, type RetroCardEffect } from '../domain/content/retroCards';
import { nextRandom, type RngState } from '../domain/random';
import type { RetroCardId } from '../domain/scrum';
import type { GameState } from '../domain/state';

// SH-056: retrospektywa — po spotkaniu oferta trzech kart (seedowany RNG, bez aktywnych), pauza
// i wybór jednej. Efekty aktywnych kart sumują się i zmieniają istniejące parametry.

const NO_EFFECT: Required<RetroCardEffect> = {
  workPermille: 0,
  bugRiskPermille: 0,
  testPermille: 0,
  drainPermille: 0,
  satisfactionPerDay: 0,
  ceremonyPermille: 0,
};

export function activeEffect(state: GameState): Required<RetroCardEffect> {
  const total = { ...NO_EFFECT };
  for (const id of state.scrum?.cards ?? []) {
    const effect = retroCardById(id)?.effect ?? {};
    for (const key of Object.keys(total) as (keyof RetroCardEffect)[]) {
      total[key] += effect[key] ?? 0;
    }
  }
  return total;
}

export function drawRetroCards(
  state: GameState,
  config: BalanceConfig,
): { offered: RetroCardId[]; rng: RngState } {
  const active = new Set(state.scrum?.cards ?? []);
  const pool = RETRO_CARDS.map((c) => c.id).filter((id) => !active.has(id));
  const offered: RetroCardId[] = [];
  let rng = state.rng;
  while (offered.length < config.scrum.retroCardsOffered && pool.length > 0) {
    const roll = nextRandom(rng);
    rng = roll.state;
    const [picked] = pool.splice(Math.floor(roll.value * pool.length), 1);
    if (picked) offered.push(picked);
  }
  return { offered, rng };
}

// Koniec spotkania retro: oferta kart i pauza (jak zdarzenie z decyzją).
export function openRetro(state: GameState, config: BalanceConfig): GameState {
  if (!state.scrum) return state;
  const { offered, rng } = drawRetroCards(state, config);
  return {
    ...state,
    rng,
    mission: { ...state.mission, speed: 0 },
    scrum: { ...state.scrum, pendingRetro: { offered } },
  };
}
