import { describe, expect, it } from 'vitest';
import { nextRandom, seedRng, type RngState } from './random';

function draw(state: RngState, count: number): { values: number[]; state: RngState } {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const result = nextRandom(state);
    values.push(result.value);
    state = result.state;
  }
  return { values, state };
}

describe('random', () => {
  it('daje tę samą sekwencję dla tego samego ziarna', () => {
    expect(draw(seedRng(42), 20).values).toEqual(draw(seedRng(42), 20).values);
  });

  it('daje różne sekwencje dla różnych ziaren', () => {
    expect(draw(seedRng(1), 5).values).not.toEqual(draw(seedRng(2), 5).values);
  });

  it('wznawia sekwencję z zapisanego stanu po serializacji', () => {
    const full = draw(seedRng(7), 10).values;
    const firstHalf = draw(seedRng(7), 5);
    const restored = JSON.parse(JSON.stringify(firstHalf.state)) as RngState;

    expect([...firstHalf.values, ...draw(restored, 5).values]).toEqual(full);
  });

  it('zwraca wartości z przedziału [0, 1) i stan jako uint32', () => {
    const { values, state } = draw(seedRng(-1), 1000);

    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(Number.isInteger(state) && state >= 0 && state <= 0xffffffff).toBe(true);
  });
});
