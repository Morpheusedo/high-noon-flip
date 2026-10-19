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

  it('refuses what is not an amount, out of range or over the balance', () => {
    expect(checkTypedBet(config, 10_000, null)).toEqual({ kind: 'notAmount' });
    expect(checkTypedBet(config, 10_000, 0)).toEqual({ kind: 'notAmount' });
    expect(checkTypedBet(config, 10_000, 5)).toEqual({ kind: 'min' });
    expect(checkTypedBet(config, 10_000, 2001)).toEqual({ kind: 'max' });
    expect(checkTypedBet(config, 700, 735)).toEqual({ kind: 'balance' });
    // the balance is checked against the rounded stake
    expect(checkTypedBet(config, 735, 737)).toEqual({ kind: 'rounded', stake: 735 });
  });

  it('takes nothing typed without typed stakes', () => {
    expect(checkTypedBet({ ...config, customBet: null }, 10_000, 500)).toEqual({
      kind: 'notAmount',
    });
  });
});
