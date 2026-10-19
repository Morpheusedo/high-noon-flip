/**
 * The showdown: how a flip grows tense as the run nears the top of the ladder.
 * Every threshold and duration of it is here.
 *
 *   0  calm      the lower rungs: the flip as it always was
 *   1  duel      from the fourth rung from the top: the light closes in on the
 *                coin, the music ducks, a slow heartbeat, the flight slows at the end
 *   2  showdown  the last two rungs: all of that, a faster heartbeat, the camera
 *                pushes in on the coin, a beat of near silence before the landing,
 *                then a sting
 *
 * The level comes from the rung the coming flip would reach, never from its
 * outcome. The outcome is already known while the coin flies, and any difference
 * between a winning and a losing flip would give it away (a fake near-miss).
 *
 * It runs from the tap to the landing only. While the player decides whether to
 * cash out the screen stays calm: a heartbeat during that decision would be
 * pressure to play on, which providers and regulators reject.
 */
import type { Speed } from '../shell/settings';

export type TensionLevel = 0 | 1 | 2;

export type HeartbeatCue = 'heartbeat-slow' | 'heartbeat-fast';

export interface Tension {
  level: TensionLevel;
  /** Light left around the coin, 0 to 1; 1 takes none. */
  light: number;
  /** The interface dims, all but the ladder, whose next rung glows. */
  dimHud: boolean;
  /** How long the light takes to close in. */
  inMs: number;
  /** Camera scale toward the coin; 1 is none. */
  zoom: number;
  /** How long the camera takes to push in. */
  zoomMs: number;
  /** Extra time in the air, all of it in the flight's last third. */
  slowMs: number;
  /** Music level while it lasts, in dB; 0 leaves the music alone. */
  duckDb: number;
  heartbeat: { cue: HeartbeatCue; everyMs: number } | null;
  /** Near silence for this long before the landing; 0 for none. */
  hushMs: number;
  /** Music level of that near silence, in dB. */
  hushDb: number;
  /** A sting as the coin lands, the same whatever the outcome. */
  sting: boolean;
  /** How long everything takes to go back after the landing or an error. */
  outMs: number;
}

/** Duel on the last four rungs, showdown on the last two (of any ladder). */
const DUEL_FROM_TOP = 4;
const SHOWDOWN_FROM_TOP = 2;

/**
 * The level of a flip that would reach `rung` (1 is the first) of a ladder of
 * `ladderLength`. The first flip of a round is a fresh stake rather than a
 * climb, so it is never tense, even on a short ladder.
 */
export function tensionLevel(rung: number, ladderLength: number): TensionLevel {
  if (rung < 2 || rung > ladderLength) return 0;
  const fromTop = ladderLength - rung + 1;
  if (fromTop <= SHOWDOWN_FROM_TOP) return 2;
  if (fromTop <= DUEL_FROM_TOP) return 1;
  return 0;
}

export const CALM: Tension = {
  level: 0,
  light: 1,
  dimHud: false,
  inMs: 0,
  zoom: 1,
  zoomMs: 0,
  slowMs: 0,
  duckDb: 0,
  heartbeat: null,
  hushMs: 0,
  hushDb: 0,
  sting: false,
  outMs: 0,
};

/** At 1x; faster speeds scale the times. */
const LIGHT = 0.6;
const IN_MS = 450;
const ZOOM = 1.2;
const ZOOM_MS = 1500;
const SLOW_MS: Record<TensionLevel, number> = { 0: 0, 1: 500, 2: 900 };
const DUCK_DB = -8;
const HEARTBEAT: Record<TensionLevel, Tension['heartbeat']> = {
  0: null,
  1: { cue: 'heartbeat-slow', everyMs: 1000 },
  2: { cue: 'heartbeat-fast', everyMs: 600 },
};
const HUSH_MS = 450;
const HUSH_DB = -30;
const OUT_MS = 500;

/**
 * What each speed keeps: 2x everything, with the slowdown and the push-in half
 * as long; 4x only the darkening, as its whole flip lasts under half a second.
 */
const BY_SPEED: Record<Speed, { time: number; motion: boolean; sound: boolean }> = {
  1: { time: 1, motion: true, sound: true },
  2: { time: 0.5, motion: true, sound: true },
  4: { time: 0.24, motion: false, sound: false },
};

/** The cues of a level at a speed. Reduced motion keeps the darkening and the sound, with no zoom and no slow motion. */
export function tensionFor(level: TensionLevel, speed: Speed, reducedMotion: boolean): Tension {
  if (level === 0) return CALM;
  const { time, motion, sound } = BY_SPEED[speed];
  const move = motion && !reducedMotion;
  const showdown = level === 2;
  return {
    level,
    light: LIGHT,
    dimHud: true,
    inMs: Math.round(IN_MS * time),
    zoom: move && showdown ? ZOOM : 1,
    zoomMs: move && showdown ? Math.round(ZOOM_MS * time) : 0,
    slowMs: move ? Math.round(SLOW_MS[level] * time) : 0,
    duckDb: sound ? DUCK_DB : 0,
    heartbeat: sound ? HEARTBEAT[level] : null,
    hushMs: sound && showdown ? Math.round(HUSH_MS * time) : 0,
    hushDb: HUSH_DB,
    sting: sound && showdown,
    outMs: Math.round(OUT_MS * Math.max(time, 0.5)),
  };
}
