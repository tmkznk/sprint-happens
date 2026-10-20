// T:TIME-T04 — generator losowy z jawnym, serializowalnym stanem (mulberry32, 32 bity).
// Funkcje są czyste: zwracają wartość i nowy stan, który system zapisuje z powrotem do GameState.
export type RngState = number;

export function seedRng(seed: number): RngState {
  return seed >>> 0;
}

export function nextRandom(state: RngState): { value: number; state: RngState } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296, state: nextState };
}
