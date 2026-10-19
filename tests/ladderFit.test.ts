import { describe, expect, it } from 'vitest';
import { fitLadder, ladderWindow, type LadderMeasure } from '../src/game/ui/ladderFit';

/** Eight rungs as measured at 10 px digits, each with its "×" (4.5 px). */
const measure = (room: number, step = 0): LadderMeasure => ({
  room,
  rungs: [23.5, 23.5, 23.5, 23.5, 23.5, 23.5, 20.8, 20.8],
  x: 4.5,
  ellipsis: 8.5,
  gap: 6,
  padding: 12,
  font: 10,
  step,
});

// rungs 182.6 - 7 × 4.5 = 151.1 wide; 7 gaps and the padding 54
const NATURAL = 151.1 + 54;

describe('the ladder fit', () => {
  it('leaves a ladder that fits as it is', () => {
    expect(fitLadder(measure(NATURAL + 1))).toEqual({ gap: 1, rung: 1, window: null });
    expect(fitLadder(measure(Infinity))).toEqual({ gap: 1, rung: 1, window: null });
  });

  it('narrows the gaps first', () => {
    const fit = fitLadder(measure(NATURAL - 10));
    expect(fit.rung).toBe(1);
    expect(fit.window).toBeNull();
    expect(151.1 + fit.gap * 54).toBeCloseTo(NATURAL - 10);
  });

  it('then the rungs, down to 9 px digits', () => {
    // the gaps at their 4 px floor take 36
    const fit = fitLadder(measure(151.1 * 0.95 + 36));
    expect(fit.gap).toBeCloseTo(4 / 6);
    expect(fit.rung).toBeCloseTo(0.95);
    expect(fit.window).toBeNull();
  });

  it('shows a window of rungs below that', () => {
    const fit = fitLadder(measure(150));
    expect(fit.rung).toBeCloseTo(0.9);
    expect(fit.window).toBe(5);
    expect(fit.gap).toBeGreaterThanOrEqual(4 / 6);
    expect(fit.gap).toBeLessThanOrEqual(1);
  });

  it('keeps the same window while the run climbs', () => {
    const sizes = [0, 3, 7].map((step) => fitLadder(measure(150, step)).window);
    expect(new Set(sizes).size).toBe(1);
  });

  it('never shows fewer than the next rung and the top', () => {
    expect(fitLadder(measure(20)).window).toBe(2);
  });
});

describe('the ladder window', () => {
  const shown = (n: number, step: number, size: number | null) => {
    const w = ladderWindow(n, step, size);
    return { rungs: w.shown.flatMap((on, i) => (on ? [i] : [])), ellipsis: w.ellipsis };
  };

  it('shows every rung without a window', () => {
    expect(shown(8, 3, null)).toEqual({ rungs: [0, 1, 2, 3, 4, 5, 6, 7], ellipsis: false });
    expect(shown(8, 3, 8)).toEqual({ rungs: [0, 1, 2, 3, 4, 5, 6, 7], ellipsis: false });
  });

  it('starts with the next rung, then the top after an ellipsis', () => {
    expect(shown(8, 0, 5)).toEqual({ rungs: [0, 1, 2, 3, 7], ellipsis: true });
  });

  it('slides with the run: the last climbed, the next, the ones after, the top', () => {
    expect(shown(8, 1, 5)).toEqual({ rungs: [0, 1, 2, 3, 7], ellipsis: true });
    expect(shown(8, 2, 5)).toEqual({ rungs: [1, 2, 3, 4, 7], ellipsis: true });
  });

  it('closes up near the top', () => {
    expect(shown(8, 4, 5)).toEqual({ rungs: [3, 4, 5, 6, 7], ellipsis: false });
    expect(shown(8, 7, 5)).toEqual({ rungs: [3, 4, 5, 6, 7], ellipsis: false });
  });

  it('keeps the next rung before the last climbed when there is room for two', () => {
    expect(shown(8, 3, 2)).toEqual({ rungs: [3, 7], ellipsis: true });
    expect(shown(8, 3, 3)).toEqual({ rungs: [2, 3, 7], ellipsis: true });
  });
});
