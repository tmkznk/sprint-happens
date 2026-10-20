import { describe, expect, it } from 'vitest';
import { assertValidStepMs, DAY_LENGTH_MS } from './time';

describe('time', () => {
  it('dzień pracy trwa 600 s czasu gry', () => {
    expect(DAY_LENGTH_MS).toBe(600_000);
  });

  it.each([100, 50, 1000])('akceptuje krok %s ms dzielący dzień', (stepMs) => {
    expect(() => assertValidStepMs(stepMs)).not.toThrow();
  });

  it.each([0, -100, 7, 99.5, Number.NaN])('odrzuca krok %s ms', (stepMs) => {
    expect(() => assertValidStepMs(stepMs)).toThrow();
  });
});
