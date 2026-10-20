import { describe, expect, it } from 'vitest';
import { STEPS_PER_DAY } from './time';

describe('time', () => {
  it('dzień zawiera 6000 kroków przy kroku 100 ms', () => {
    expect(STEPS_PER_DAY).toBe(6000);
  });
});
