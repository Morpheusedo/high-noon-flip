/**
 * The coin skins: what each one looks like and what play unlocks it.
 *
 * The list lives in `public/assets/images/coins/coins.json`, next to the art, so
 * a new coin is new files and a line there, with no code changes. This file
 * describes that JSON and checks it on load. Skins are for looks only: no rule
 * may depend on the stake or on money spent, and none changes the odds.
 */
import { assetUrl } from '../../shell/assets';

/**
 * What unlocks a skin, counted from round results only:
 * - `{ flips: 50 }`: 50 flips, won or lost;
 * - `{ rung: 5 }`: a run reaches rung 5; `{ rung: 3, runs: 3 }`: three runs reach rung 3;
 *   `"top"` is the last rung of the ladder the server sends;
 * - `{ cashout: 4 }`: a cash out at rung 4 or higher (the top rung's payout counts).
 */
export type UnlockRule =
  { flips: number } | { rung: number | 'top'; runs?: number } | { cashout: number | 'top' };

export interface CoinSkin {
  id: string;
  /** Face files, relative to the manifest's folder. */
  sheriff: string;
  outlaw: string;
  /** A small picture for the collection grid. */
  icon: string;
  /** The coin's edge: in shade, in light, and its bright streak (`#rrggbb`). */
  rim: readonly [string, string, string];
  /** Null for a skin every player owns from the first visit. */
  unlock: UnlockRule | null;
}

/**
 * The skins in the order of the path a player climbs, which is the order the
 * settings show them in. Two roles are kept apart: the fallback and the start.
 */
export interface CoinManifest {
  /**
   * The fallback: the faces shown when a skin's art is missing. It is part of the
   * game's required art (its failure is a loading error), whether or not the
   * player owns it; owning it is its own rule.
   */
  classic: string;
  /** The skin a new player wears, owned from the first visit. */
  start: string;
  skins: CoinSkin[];
}

export const COINS_DIR = 'images/coins';

/** URL of a file named in the manifest. */
export function coinUrl(file: string): string {
  return assetUrl(`${COINS_DIR}/${file}`);
}

export async function loadCoinManifest(): Promise<CoinManifest> {
  const response = await fetch(coinUrl('coins.json'));
  if (!response.ok) throw new Error(`coins.json: HTTP ${response.status}`);
  return checkManifest(await response.json());
}

export function skinOf(manifest: CoinManifest, id: string): CoinSkin | undefined {
  return manifest.skins.find((s) => s.id === id);
}

/** The fallback skin, whose faces stand in for missing art. */
export function classicOf(manifest: CoinManifest): CoinSkin {
  const classic = skinOf(manifest, manifest.classic);
  if (!classic) throw new Error(`coins.json: no skin "${manifest.classic}"`);
  return classic;
}

/** Whether every player owns `skin` from the first visit. */
export function isFree(skin: CoinSkin): boolean {
  return skin.unlock === null;
}

const COLOR = /^#[0-9a-f]{6}$/i;

/** Throws on anything odd, so a broken manifest stops the build's tests, not a round. */
export function checkManifest(json: unknown): CoinManifest {
  const at = (path: string, ok: boolean) => {
    if (!ok) throw new Error(`coins.json: bad ${path}`);
  };
  const m = json as CoinManifest;
  at('manifest', typeof m === 'object' && m !== null && Array.isArray(m.skins));
  const ids = new Set<string>();
  m.skins.forEach((s, i) => {
    const path = `skins[${i}]`;
    at(path, typeof s === 'object' && s !== null);
    at(`${path}.id`, typeof s.id === 'string' && /^[a-z0-9-]+$/.test(s.id) && !ids.has(s.id));
    ids.add(s.id);
    for (const file of ['sheriff', 'outlaw', 'icon'] as const)
      at(`${path}.${file}`, typeof s[file] === 'string' && s[file].length > 0);
    at(
      `${path}.rim`,
      Array.isArray(s.rim) && s.rim.length === 3 && s.rim.every((c) => COLOR.test(c)),
    );
    at(`${path}.unlock`, s.unlock === null || isRule(s.unlock));
  });
  at('classic', typeof m.classic === 'string' && skinOf(m, m.classic) !== undefined);
  at('start', typeof m.start === 'string' && skinOf(m, m.start)?.unlock === null);
  return m;
}

const count = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 1;
const rung = (v: unknown) => v === 'top' || count(v);

function isRule(rule: unknown): rule is UnlockRule {
  if (typeof rule !== 'object' || rule === null) return false;
  const r = rule as Record<string, unknown>;
  const keys = Object.keys(r).sort().join();
  if (keys === 'flips') return count(r.flips);
  if (keys === 'rung' || keys === 'rung,runs')
    return rung(r.rung) && (!('runs' in r) || count(r.runs));
  if (keys === 'cashout') return rung(r.cashout);
  return false;
}

/** `#rrggbb` as a number Pixi takes. */
export function colorOf(hex: string): number {
  return parseInt(hex.slice(1), 16);
}
