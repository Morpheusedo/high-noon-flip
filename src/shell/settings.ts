/**
 * The player's own settings: what they chose, not what the round is doing.
 *
 * For now only the play speed. Sound and saving between sessions join later.
 */
import { Store } from './store';

/** Play speed: shortens the flip and the pauses, never the odds or the payouts. */
export type Speed = 1 | 2 | 4;

export const SPEEDS: readonly Speed[] = [1, 2, 4];

export interface Settings {
  speed: Speed;
}

export function createSettings(): Store<Settings> {
  return new Store<Settings>({ speed: 1 });
}

/** The speed a market allows: where turbo is banned, only normal speed. */
export function allowedSpeed(speed: Speed, turboAllowed: boolean): Speed {
  return turboAllowed ? speed : 1;
}
