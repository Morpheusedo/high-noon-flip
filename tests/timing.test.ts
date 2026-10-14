import { describe, expect, it } from 'vitest';
import { timingsFor } from '../src/game/timing';
import { allowedSpeed } from '../src/shell/settings';

describe('timingsFor', () => {
  it('keeps the prototype timings at normal speed', () => {
    expect(timingsFor(1, false)).toEqual({
      pace: 1,
      cockMs: 230,
      spinMs: 900,
      flipMs: 1900,
      turns: 6,
      hold: { win: 1900, lose: 1300, step: 1100, cashout: 1900 },
    });
  });

  it('scales every duration by one factor, with a floor on the result pause', () => {
    const t = timingsFor(4, false);
    expect(t.flipMs).toBe(456);
    expect(t.turns).toBe(1);
    expect(t.hold).toEqual({ win: 456, lose: 380, step: 380, cashout: 456 });
  });

  it('drops show-only waits for reduced motion', () => {
    const t = timingsFor(1, true);
    expect(t.cockMs).toBe(0);
    expect(t.flipMs).toBe(500);
    expect(t.turns).toBe(1);
  });
});

describe('allowedSpeed', () => {
  it('falls back to normal speed where turbo is banned', () => {
    expect(allowedSpeed(4, true)).toBe(4);
    expect(allowedSpeed(4, false)).toBe(1);
    expect(allowedSpeed(2, false)).toBe(1);
  });
});
