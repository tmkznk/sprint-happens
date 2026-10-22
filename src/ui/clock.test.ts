import { describe, expect, it } from 'vitest';
import { clockLabel } from './clock';

describe('zegar biura (SH-033)', () => {
  it('600 s dnia gry to 9:00–17:00', () => {
    expect(clockLabel(0)).toBe('9:00');
    expect(clockLabel(300_000)).toBe('13:00');
    expect(clockLabel(599_900)).toBe('16:59');
    expect(clockLabel(600_000)).toBe('17:00');
  });
});
