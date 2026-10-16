import { describe, expect, it } from 'vitest';
import { betLimits, isValidBet, nextLevel, snapToGrid } from '../src/server/bets';
import type { GameConfig } from '../src/server/protocol';

const levels: GameConfig = {
  currency: { code: 'FUN', decimals: 2 },
  bets: [100, 500, 1000],
  defaultBet: 100,
  ladder: [1.98],
  rtp: 0.99,
};
const typed: GameConfig = { ...levels, customBet: { min: 10, max: 2000, step: 5 } };

describe('isValidBet', () => {
  it('takes only the levels without typed bets', () => {
    expect(isValidBet(levels, 500)).toBe(true);
    expect(isValidBet(levels, 735)).toBe(false);
    expect(isValidBet({ ...levels, customBet: null }, 735)).toBe(false);
  });

  it('takes any amount in the range on the grid', () => {
    for (const bet of [10, 15, 735, 2000, 500]) expect(isValidBet(typed, bet), `${bet}`).toBe(true);
    for (const bet of [5, 736, 2005, 0, -5, 7.5, NaN])
      expect(isValidBet(typed, bet), `${bet}`).toBe(false);
  });

  it('counts the grid from the minimum', () => {
    const odd = { ...levels, customBet: { min: 3, max: 100, step: 10 } };
    expect(isValidBet(odd, 13)).toBe(true);
    expect(isValidBet(odd, 10)).toBe(false);
  });
});

describe('the other rules', () => {
  it('give the limits of levels and typed bets together', () => {
    expect(betLimits(levels)).toEqual({ min: 100, max: 1000 });
    expect(betLimits(typed)).toEqual({ min: 10, max: 2000 });
  });

  it('round a typed amount down onto the grid', () => {
    expect(snapToGrid(typed, 737)).toBe(735);
    expect(snapToGrid(typed, 735)).toBe(735);
    expect(snapToGrid(typed, 9)).toBeNull();
    expect(snapToGrid(typed, 2001)).toBeNull();
    expect(snapToGrid(levels, 737)).toBeNull();
  });

  it('step to the next level, also from between two', () => {
    expect(nextLevel(levels.bets, 500, 1)).toBe(1000);
    expect(nextLevel(levels.bets, 500, -1)).toBe(100);
    expect(nextLevel(levels.bets, 735, 1)).toBe(1000);
    expect(nextLevel(levels.bets, 735, -1)).toBe(500);
    expect(nextLevel(levels.bets, 1000, 1)).toBeNull();
    expect(nextLevel(levels.bets, 50, -1)).toBeNull();
    expect(nextLevel(levels.bets, 50, 1)).toBe(100);
  });
});
