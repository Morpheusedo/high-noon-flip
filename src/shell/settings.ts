/**
 * The player's own settings: what they chose, not what the round is doing.
 * Saved in the browser, so the next session opens with the same sound and speed.
 * A saved value is checked field by field; anything odd falls back to the default.
 */
import { readJson, writeJson, type KeyValueStore } from './storage';
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

const STORE_KEY = 'hnf.settings';

/** Without `storage` the settings last for this page load only. */
export function createSettings(storage?: KeyValueStore | null, key = STORE_KEY): Store<Settings> {
  const settings = new Store<Settings>(readSettings(readJson(storage, key)));
  if (storage) settings.subscribe((s) => writeJson(storage, key, s));
  return settings;
}

export function readSettings(saved: unknown): Settings {
  const s = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  return {
    speed: SPEEDS.find((v) => v === s.speed) ?? d.speed,
    muted: typeof s.muted === 'boolean' ? s.muted : d.muted,
    sfxVolume: volume(s.sfxVolume, d.sfxVolume),
    musicVolume: volume(s.musicVolume, d.musicVolume),
  };
}

function volume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** The speed a market allows: where turbo is banned, only normal speed. */
export function allowedSpeed(speed: Speed, turboAllowed: boolean): Speed {
  return turboAllowed ? speed : 1;
}
