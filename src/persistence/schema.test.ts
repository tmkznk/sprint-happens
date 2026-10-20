import { describe, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type { DeepReadonly } from '../domain/readonly';
import type { GameState } from '../domain/state';
import type { gameStateShape } from './schema';

describe('gameStateShape', () => {
  // Strażnik SH-037: nowe pole w GameState bez fragmentu schematu (lub odwrotnie) psuje typecheck.
  it('opisuje dokładnie typ GameState', () => {
    expectTypeOf<DeepReadonly<z.output<typeof gameStateShape>>>().toEqualTypeOf<GameState>();
  });
});
