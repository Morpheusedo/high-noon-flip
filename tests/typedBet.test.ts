import { describe, expect, it } from 'vitest';
import type { GameConfig } from '../src/server/protocol';
import { checkTypedBet } from '../src/game/ui/typedBet';

const config: GameConfig = {
  currency: { code: 'FUN', decimals: 2 },
  bets: [100, 500, 1000],
  defaultBet: 100,
  customBet: { min: 10, max: 2000, step: 5 },
  ladder: [1.98],
  rtp: 0.99,
};

describe('checkTypedBet', () => {
  it('takes an amount on the grid, and a level as it is', () => {
    expect(checkTypedBet(config, 10_000, 735)).toEqual({ kind: 'bet', stake: 735 });
    expect(checkTypedBet(config, 10_000, 500)).toEqual({ kind: 'bet', stake: 500 });
  });

  it('rounds an amount off the grid down, to be confirmed', () => {
    expect(checkTypedBet(config, 10_000, 737)).toEqual({ kind: 'rounded', stake: 735 });
  });

  it('takes an amount out of range as the nearest stake, with no message', () => {
    expect(checkTypedBet(config, 10_000, 5)).toEqual({ kind: 'bet', stake: 10 });
    expect(checkTypedBet(config, 10_000, 1)).toEqual({ kind: 'bet', stake: 10 });
    expect(checkTypedBet(config, 10_000, 2001)).toEqual({ kind: 'bet', stake: 2000 });
    expect(checkTypedBet(config, 10_000, 500_000)).toEqual({ kind: 'bet', stake: 2000 });
  });

  it('clamps onto the grid and to a level beyond the typed range', () => {
    // the top of the range off the grid: the highest stake on it
    const offGrid = { ...config, customBet: { min: 10, max: 2003, step: 5 } };
    expect(checkTypedBet(offGrid, 10_000, 9000)).toEqual({ kind: 'bet', stake: 2000 });
    // levels outside the range are stakes too: the nearest one in the way
    const wide = { ...config, bets: [5, 100, 5000] };
    expect(checkTypedBet(wide, 10_000, 9000)).toEqual({ kind: 'bet', stake: 5000 });
    expect(checkTypedBet(wide, 10_000, 3000)).toEqual({ kind: 'bet', stake: 2000 });
    expect(checkTypedBet(wide, 10_000, 3)).toEqual({ kind: 'bet', stake: 5 });
    expect(checkTypedBet(wide, 10_000, 7)).toEqual({ kind: 'bet', stake: 10 });
  });

  it('refuses what is not an amount or is over the balance', () => {
    expect(checkTypedBet(config, 10_000, null)).toEqual({ kind: 'notAmount' });
    expect(checkTypedBet(config, 10_000, 0)).toEqual({ kind: 'notAmount' });
    expect(checkTypedBet(config, 700, 735)).toEqual({ kind: 'balance' });
    // a clamped stake is held to the balance as well
    expect(checkTypedBet(config, 1500, 5000)).toEqual({ kind: 'balance' });
    // the balance is checked against the rounded stake
    expect(checkTypedBet(config, 735, 737)).toEqual({ kind: 'rounded', stake: 735 });
  });

  it('takes nothing typed without typed stakes', () => {
    expect(checkTypedBet({ ...config, customBet: null }, 10_000, 500)).toEqual({
      kind: 'notAmount',
    });
  });
});
