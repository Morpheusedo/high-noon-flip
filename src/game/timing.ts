/**
 * Every duration of a round, in one place.
 *
 * Base values are the prototype's at normal speed. Faster speeds scale them by
 * one factor (`pace`); reduced motion cuts the flight short and drops the waits
 * that only exist for show.
 */
import type { Speed } from '../shell/settings';

export type HoldKind = 'win' | 'lose' | 'step' | 'cashout';

export interface Timings {
  /** Time factor of the speed: 1 at normal, smaller when faster. */
  pace: number;
  /** From the tap to the shot: the hammer goes back, then a beat. */
  cockMs: number;
  /** The cylinder spins after the shot. */
  spinMs: number;
  /** Coin in the air. */
  flipMs: number;
  /** Whole turns the coin makes in the air. */
  turns: number;
  /** How long each kind of result stays on screen. */
  hold: Record<HoldKind, number>;
}

const PACE: Record<Speed, number> = { 1: 1, 2: 0.5, 4: 0.24 };
const TURNS: Record<Speed, number> = { 1: 6, 2: 3, 4: 1 };
const HOLD_MS: Record<HoldKind, number> = { win: 1900, lose: 1300, step: 1100, cashout: 1900 };
/** No result is shown for less than this, at any speed. */
const MIN_HOLD_MS = 380;

export function timingsFor(speed: Speed, reducedMotion: boolean): Timings {
  const pace = PACE[speed];
  const hold = {} as Record<HoldKind, number>;
  for (const kind of Object.keys(HOLD_MS) as HoldKind[])
    hold[kind] = Math.max(MIN_HOLD_MS, Math.round(HOLD_MS[kind] * pace));
  return {
    pace,
    cockMs: reducedMotion ? 0 : Math.round(230 * pace),
    spinMs: Math.round(300 + 600 * pace),
    flipMs: reducedMotion ? 500 : Math.round(1900 * pace),
    turns: reducedMotion ? 1 : TURNS[speed],
    hold,
  };
}
