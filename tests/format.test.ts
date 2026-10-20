import { describe, expect, it } from 'vitest';
import { formats } from '../src/game/ui/format';

describe('factor', () => {
  it('shortens a multiplier down, never up, so the ladder never promises more than it pays', () => {
    const { factor } = formats({ code: 'FUN', decimals: 2 }, 'en');
    const ladder = [1.98, 3.96, 7.92, 15.84, 31.68, 63.36, 126.72, 253.44];
    expect(ladder.map(factor)).toEqual([
      '1.98',
      '3.96',
      '7.92',
      '15.8',
      '31.6',
      '63.3',
      '126',
      '253',
    ]);
    expect(factor(2.29)).toBe('2.29');
    expect(factor(10)).toBe('10.0');
  });
});
