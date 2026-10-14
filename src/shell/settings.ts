/**
 * The player's own settings: what they chose, not what the round is doing.
 * Kept for this session only; saving them between sessions comes with the
 * settings screen.
 */
import { Store } from './store';

/** Play speed: shortens the flip and the pauses, never the odds or the payouts. */
export type Speed = 1 | 2 | 4;

export const SPEEDS: readonly Speed[] = [1, 2, 4];

export interface Settings {
  speed: Speed;
  muted: boolean;
  /** Sound effects volume, 0 to 100. */
  sfxVolume: number;
  /** Music volume, 0 to 100. */
  musicVolume: number;
}

/** Quiet by default: a casino lobby is often open next to other games and streams. */
export const DEFAULT_SETTINGS: Settings = { speed: 1, muted: false, sfxVolume: 15, musicVolume: 6 };

export function createSettings(): Store<Settings> {
  return new Store<Settings>({ ...DEFAULT_SETTINGS });
}

/** The speed a market allows: where turbo is banned, only normal speed. */
export function allowedSpeed(speed: Speed, turboAllowed: boolean): Speed {
  return turboAllowed ? speed : 1;
}
