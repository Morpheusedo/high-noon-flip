/**
 * What the player should press next, and how loudly the interface says so.
 *
 * Between rounds BET comes first and the side second. The control that is next
 * glows and pulses (or hops, for the emblems); a new player also gets a pointer
 * with a short label, until they have started `STRONG_HINT_ROUNDS` rounds.
 */
import { isIdle, type RoundState } from '../model/RoundModel';

/** Rounds with the pointer and the label: a first visit and the first three rounds. */
export const STRONG_HINT_ROUNDS = 3;

/** BET between rounds, a side once it is pressed; nothing to point at otherwise. */
export type Next = 'bet' | 'side' | null;

export function nextAction(s: RoundState): Next {
  if (!isIdle(s) || s.openRun) return null;
  return s.armed ? 'side' : 'bet';
}

/** `strong`: pointer and label; `quiet`: the glow and the pulse alone. */
export type HintLevel = 'strong' | 'quiet';

export function hintLevel(roundsPlayed: number): HintLevel {
  return roundsPlayed < STRONG_HINT_ROUNDS ? 'strong' : 'quiet';
}

/** The count to save after a round starts: it stops where the hints no longer change. */
export function countRound(roundsPlayed: number): number {
  return Math.min(roundsPlayed + 1, STRONG_HINT_ROUNDS);
}
