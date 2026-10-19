import { describe, expect, it } from 'vitest';
import {
  angleAt,
  chamberFit,
  dialStops,
  followDrum,
  restingLevel,
  slotLevels,
  SLOTS,
  withGive,
} from '../src/game/ui/dial';
import { formats } from '../src/game/ui/format';

/** The chamber under the marker, then clockwise: what the player sees around the chosen bet. */
function aroundMarker(pos: number, count: number) {
  const levels = slotLevels(pos, count);
  const top = ((Math.round(pos) % SLOTS) + SLOTS) % SLOTS;
  return [-2, -1, 0, 1, 2].map((d) => levels[(top + d + SLOTS) % SLOTS]);
}

describe('bet dial', () => {
  it('shows the chosen level under the marker and its neighbours either side', () => {
    expect(aroundMarker(10, 20)).toEqual([8, 9, 10, 11, 12]);
  });

  it('leaves the chambers past either end empty', () => {
    expect(aroundMarker(0, 20)).toEqual([null, null, 0, 1, 2]);
    expect(aroundMarker(19, 20)).toEqual([17, 18, 19, null, null]);
  });

  it('works with fewer levels than chambers', () => {
    expect(slotLevels(0, 2).filter((l) => l !== null)).toEqual([0, 1]);
  });

  it('never relabels a chamber in view while turning one level', () => {
    // a chamber in view is within two levels of the marker; check the labels at every
    // tenth of a level along a turn, for every chamber that stays in view
    for (let pos = 5; pos <= 6; pos += 0.1) {
      const levels = slotLevels(pos, 20);
      for (let slot = 0; slot < SLOTS; slot++) {
        const level = levels[slot];
        if (level !== null && level !== undefined && Math.abs(level - pos) <= 2)
          expect(slotLevels(5, 20)[slot] === level || slotLevels(6, 20)[slot] === level).toBe(true);
      }
    }
  });

  it('turns 60 degrees per level, from the marker side', () => {
    expect(angleAt(0, 0)).toBe(0);
    expect(angleAt(2, 0)).toBe(-120);
    expect(angleAt(1, -90)).toBe(-150);
  });

  it('gives a little past the ends but never a whole level', () => {
    expect(withGive(3, 10)).toBe(3);
    expect(withGive(-5, 10)).toBeLessThan(0);
    expect(withGive(-5, 10)).toBeGreaterThan(-0.5);
    expect(withGive(20, 10)).toBeLessThan(9.5);
  });

  it('stops at a typed bet between two levels, in its place', () => {
    expect(dialStops([100, 500, 1000], 500)).toEqual([100, 500, 1000]);
    expect(dialStops([100, 500, 1000], 735)).toEqual([100, 500, 735, 1000]);
    expect(dialStops([100, 500, 1000], 50)).toEqual([50, 100, 500, 1000]);
    expect(dialStops([100, 500, 1000], 2000)).toEqual([100, 500, 1000, 2000]);
  });

  it('turns one chamber from a typed bet to the level above or below it', () => {
    const levels = [100, 500, 1000, 2500];
    const typed = followDrum(null, dialStops(levels, 735), 735);
    expect(typed.pos).toBe(2);
    // up: 10 stays in the chamber it had, one past the typed amount
    const up = followDrum(typed, dialStops(levels, 1000), 1000);
    expect(up.pos).toBe(3);
    expect(slotLevels(up.pos, levels.length, up.pos - up.index)[3]).toBe(levels.indexOf(1000));
    // down: one chamber back
    expect(followDrum(typed, dialStops(levels, 500), 500).pos).toBe(1);
  });

  it('keeps every level in its chamber once the typed bet is gone', () => {
    const levels = [100, 500, 1000, 2500];
    let drum = followDrum(null, dialStops(levels, 735), 735);
    drum = followDrum(drum, dialStops(levels, 1000), 1000);
    const base = drum.pos - drum.index;
    // the levels around the marker are the ones a turn either way reaches
    const shown = slotLevels(drum.pos, levels.length, base).map((l) =>
      l === null ? null : levels[l],
    );
    expect(shown[(drum.pos + 1) % SLOTS]).toBe(2500);
    expect(shown[(drum.pos - 1 + SLOTS) % SLOTS]).toBe(500);
  });

  it('fits a typed amount to its chamber, or gives it a mark when it would not read', () => {
    // fits at the chamber's own size
    expect(chamberFit(30, 33, 14.6)).toBe(1);
    // shrinks to fit, down to 60% of the chamber's font
    expect(chamberFit(44, 33, 14.6)).toBeCloseTo(0.75);
    expect(chamberFit(56, 33, 14.6)).toBeNull();
    // and never below 9 px digits, on a small phone
    expect(chamberFit(40, 30, 12)).toBeCloseTo(0.75);
    expect(chamberFit(48, 30, 12)).toBeNull();
    // a big chamber takes a long amount a phone would not
    expect(chamberFit(115, 73, 30)).toBeCloseTo(0.635, 3);
    expect(chamberFit(150, 73, 30)).toBeNull();
  });

  it('rests on the nearest level, carried at most two by a flick', () => {
    expect(restingLevel(4.4, 0, 20)).toBe(4);
    expect(restingLevel(4.4, 10, 20)).toBe(6);
    expect(restingLevel(1, -10, 20)).toBe(0);
    expect(restingLevel(18.6, 0, 20)).toBe(19);
  });
});

describe('interface formats', () => {
  const fun = formats({ code: 'FUN', decimals: 2 }, 'en');

  it('prints bets as short as they can be', () => {
    expect(fun.short(100)).toBe('1');
    expect(fun.short(250)).toBe('2.50');
    expect(fun.short(100_000)).toBe('1,000');
    expect(fun.short(5_000_000)).toBe('50K');
  });

  it('prints a typed amount without rounding it, in every currency', () => {
    expect(fun.exact(1235)).toBe('12.35');
    expect(fun.exact(2_500)).toBe('25');
    expect(fun.exact(999_999_999)).toBe('9,999,999.99');
    expect(formats({ code: 'JPY', decimals: 0 }, 'en').exact(1_234_567)).toBe('1,234,567');
    expect(formats({ code: 'BTC', decimals: 8 }, 'en').exact(12_345)).toBe('0.00012345');
  });

  it('drops decimals from multipliers as they grow', () => {
    expect([1.98, 15.84, 253.44].map(fun.multiplier)).toEqual(['×1.98', '×15.8', '×253']);
  });

  it('follows the language', () => {
    expect(formats({ code: 'EUR', decimals: 2 }, 'de').short(250)).toBe('2,50');
  });
});
