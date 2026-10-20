/**
 * Where the collection is kept. One interface, so the place can change without
 * the game noticing: today the browser's storage, later perhaps the player's
 * profile on the provider's side (open question 13 in docs/ROADMAP.md), which
 * would survive another device and a cleared browser.
 */
import { readJson, writeJson, type KeyValueStore } from '../../shell/storage';
import { EMPTY_PROGRESS, type CollectionProgress } from './unlock';

export interface CollectionStore {
  /** The saved progress, or an empty one; never fails. */
  load(): Promise<CollectionProgress>;
  /** Saves the progress; a failure leaves it for this session only. */
  save(progress: CollectionProgress): Promise<void>;
}

const STORE_KEY = 'hnf.coins';

/**
 * The saved shape's version. 1 (step 22, no `v`): the classic coin was every
 * player's and never listed. 2: the rusty coin is the start and the classic one
 * is earned, so a version 1 save gets the classic coin it already had.
 */
const VERSION = 2;

/** The browser's storage; without one the collection lasts for this page load. */
export function localCollectionStore(
  storage: KeyValueStore | null,
  key = STORE_KEY,
): CollectionStore {
  return {
    load: () => Promise.resolve(readProgress(readJson(storage, key))),
    save: (progress) => {
      writeJson(storage, key, { v: VERSION, ...progress });
      return Promise.resolve();
    },
  };
}

/**
 * A saved value checked field by field; anything odd falls back to the empty value.
 * Skins it names that the manifest no longer has are dropped by the collection.
 */
export function readProgress(saved: unknown): CollectionProgress {
  if (typeof saved !== 'object' || saved === null) return EMPTY_PROGRESS;
  const s = saved as Record<string, unknown>;
  const e = EMPTY_PROGRESS;
  const unlocked = Array.isArray(s.unlocked)
    ? s.unlocked.filter((id): id is string => typeof id === 'string')
    : [];
  // version 1 listed no classic coin: every player had it
  if (s.v === undefined) unlocked.unshift('classic');
  const run = s.run as Record<string, unknown> | null | undefined;
  return {
    flips: whole(s.flips) ?? e.flips,
    runs: Array.isArray(s.runs) ? s.runs.map((n) => whole(n) ?? 0) : e.runs,
    cashout: whole(s.cashout) ?? e.cashout,
    run:
      typeof run === 'object' && run !== null && typeof run.id === 'string' && whole(run.best)
        ? { id: run.id, best: whole(run.best) ?? 0 }
        : e.run,
    unlocked: [...new Set(unlocked)],
    chosen: typeof s.chosen === 'string' ? s.chosen : e.chosen,
  };
}

function whole(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}
