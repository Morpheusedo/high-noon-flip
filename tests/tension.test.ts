import { describe, expect, it } from 'vitest';
import { slowLastThird } from '../src/game/scene/tween';
import { CALM, tensionFor, tensionLevel } from '../src/game/tension';

const levels = (ladderLength: number) =>
  Array.from({ length: ladderLength }, (_, i) => tensionLevel(i + 1, ladderLength));

describe('tensionLevel', () => {
  it('makes the 5th and 6th rungs of 8 a duel and the last two a showdown', () => {
    expect(levels(8)).toEqual([0, 0, 0, 0, 1, 1, 2, 2]);
  });

  it('counts from the top of any ladder', () => {
    expect(levels(12)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2]);
    expect(levels(5)).toEqual([0, 1, 1, 2, 2]);
  });

  it('never makes the first flip of a round tense, even on a short ladder', () => {
    expect(levels(4)).toEqual([0, 1, 2, 2]);
    expect(levels(2)).toEqual([0, 2]);
    expect(levels(1)).toEqual([0]);
  });

  it('is calm off the ladder', () => {
    expect(tensionLevel(0, 8)).toBe(0);
    expect(tensionLevel(9, 8)).toBe(0);
  });
});

describe('tensionFor', () => {
  it('is calm on the lower rungs', () => {
    expect(tensionFor(0, 1, false)).toBe(CALM);
  });

  it('slows a duel by 500 ms at 1x, with a slow heartbeat and no push-in', () => {
    expect(tensionFor(1, 1, false)).toMatchObject({
      light: 0.6,
      dimHud: true,
      zoom: 1,
      slowMs: 500,
      duckDb: -8,
      heartbeat: { cue: 'heartbeat-slow' },
      hushMs: 0,
      sting: false,
    });
  });

  it('slows a showdown by 900 ms at 1x, pushes in, hushes and stings', () => {
    expect(tensionFor(2, 1, false)).toMatchObject({
      light: 0.6,
      zoom: 1.2,
      zoomMs: 1500,
      slowMs: 900,
      duckDb: -8,
      heartbeat: { cue: 'heartbeat-fast' },
      hushMs: 450,
      sting: true,
    });
    const slow = tensionFor(1, 1, false).heartbeat?.everyMs ?? 0;
    expect(tensionFor(2, 1, false).heartbeat?.everyMs).toBeLessThan(slow);
  });

  it('halves the slowdown and the push-in at 2x', () => {
    expect(tensionFor(1, 2, false).slowMs).toBe(250);
    expect(tensionFor(2, 2, false)).toMatchObject({ slowMs: 450, zoom: 1.2, zoomMs: 750 });
  });

  it('keeps only the darkening at 4x', () => {
    for (const level of [1, 2] as const)
      expect(tensionFor(level, 4, false)).toMatchObject({
        light: 0.6,
        dimHud: true,
        zoom: 1,
        slowMs: 0,
        duckDb: 0,
        heartbeat: null,
        hushMs: 0,
        sting: false,
      });
  });

  it('drops the push-in and the slow motion for reduced motion, keeping light and sound', () => {
    expect(tensionFor(2, 1, true)).toMatchObject({
      light: 0.6,
      zoom: 1,
      slowMs: 0,
      duckDb: -8,
      heartbeat: { cue: 'heartbeat-fast' },
      hushMs: 450,
      sting: true,
    });
  });
});

describe('slowLastThird', () => {
  it('is steady without slow motion', () => {
    expect(slowLastThird(1900, 0)(0.4)).toBe(0.4);
  });

  it('runs the first two thirds as before, then slows to the end', () => {
    const [ms, slowMs] = [1900, 900];
    const f = slowLastThird(ms, slowMs);
    const at = (elapsed: number) => f(elapsed / (ms + slowMs));
    expect(at(0)).toBe(0);
    expect(at(ms / 3)).toBeCloseTo(1 / 3);
    expect(at((2 * ms) / 3)).toBeCloseTo(2 / 3);
    expect(at(ms + slowMs)).toBeCloseTo(1);
    // past the cut it falls behind the old flight, and it never goes back
    expect(at(ms * 0.9)).toBeLessThan(0.9);
    let last = 0;
    for (let i = 1; i <= 200; i++) {
      const p = f(i / 200);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });

  it('leaves the cut at the speed it had', () => {
    const [ms, slowMs] = [1900, 500];
    const f = slowLastThird(ms, slowMs);
    const cut = (2 * ms) / 3 / (ms + slowMs);
    const e = 1e-5;
    const before = (f(cut) - f(cut - e)) / e;
    const after = (f(cut + e) - f(cut)) / e;
    expect(after).toBeCloseTo(before, 2);
  });
});
