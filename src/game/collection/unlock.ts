/**
 * What the player has done, counted from round results, and which skins that unlocks.
 *
 * Only results count: a flip the server answered and the client showed, a cash
 * out it paid. No timers, no stakes, no money: a 5.00 run to rung 5 counts the
 * same as a 100.00 one, so the collection never pushes a bigger bet.
 */
import type { RoundState } from '../model/RoundModel';
import { isFree, skinOf, type CoinManifest, type CoinSkin, type UnlockRule } from './skins';

export interface CollectionProgress {
  /** Flips seen, won or lost. */
  flips: number;
  /** `runs[k - 1]`: how many runs reached rung k or higher. */
  runs: number[];
  /** The highest rung cashed out at; 0 for none. */
  cashout: number;
  /** The run counted last and its highest rung, so a run resumed after a reload is not counted twice. */
  run: { id: string; best: number } | null;
  /** Every skin the player owns, the starting one included, in the order they came. */
  unlocked: string[];
  /** The skin the player chose; empty until they have one, which means the starting skin. */
  chosen: string;
}

export const EMPTY_PROGRESS: CollectionProgress = {
  flips: 0,
  runs: [],
  cashout: 0,
  run: null,
  unlocked: [],
  chosen: '',
};

/** What a round result means for the collection. */
export type PlayEvent =
  /** A flip; `rung` is where the run stands after it, 0 when it was lost. */
  | { kind: 'flip'; round: string; rung: number }
  /** Money taken at `rung`: a cash out, or the top rung paying out by itself. */
  | { kind: 'cashout'; rung: number };

/** The events in a change of the round state: only on the step into `result`. */
export function eventsOf(state: RoundState, previous: RoundState): PlayEvent[] {
  const { phase } = state;
  if (phase.name !== 'result' || previous.phase.name === 'result') return [];
  const before = previous.openRun;
  const { outcome, flip } = phase;
  if (!flip) return outcome.kind === 'win' ? [{ kind: 'cashout', rung: before?.step ?? 0 }] : [];
  if (outcome.kind === 'lose') return [{ kind: 'flip', round: before?.roundId ?? '', rung: 0 }];
  if (outcome.kind === 'step') {
    const run = state.openRun;
    return [{ kind: 'flip', round: run?.roundId ?? '', rung: run?.step ?? 0 }];
  }
  // a won flip that closes the run with a payout: the top rung
  const top = (before?.step ?? 0) + 1;
  return [
    { kind: 'flip', round: before?.roundId ?? '', rung: top },
    { kind: 'cashout', rung: top },
  ];
}

/** Adds `events` to the progress. */
export function count(progress: CollectionProgress, events: PlayEvent[]): CollectionProgress {
  let p = progress;
  for (const e of events) {
    if (e.kind === 'cashout') {
      p = { ...p, cashout: Math.max(p.cashout, e.rung) };
      continue;
    }
    p = { ...p, flips: p.flips + 1 };
    if (e.rung === 0) continue;
    // every rung this run passed for the first time counts once
    const best = p.run?.id === e.round ? p.run.best : 0;
    if (e.rung <= best) continue;
    const runs = [...p.runs];
    for (let k = best + 1; k <= e.rung; k++) runs[k - 1] = (runs[k - 1] ?? 0) + 1;
    p = { ...p, runs, run: { id: e.round, best: e.rung } };
  }
  return p;
}

/** The rung a rule names, with "top" read off the server's ladder. */
function rungOf(rung: number | 'top', ladderLength: number): number {
  return rung === 'top' ? ladderLength : rung;
}

/**
 * How far the player is towards `rule`: `done` of `goal`. A rule met once (a rung,
 * a cash out) counts the best rung so far towards it, so even a goal of one feat
 * shows how near the player came.
 */
export function progressOf(
  rule: UnlockRule,
  p: CollectionProgress,
  ladderLength: number,
): { done: number; goal: number } {
  if ('flips' in rule) return { done: Math.min(p.flips, rule.flips), goal: rule.flips };
  if ('cashout' in rule) {
    const goal = rungOf(rule.cashout, ladderLength);
    return { done: Math.min(p.cashout, goal), goal };
  }
  const rung = rungOf(rule.rung, ladderLength);
  if (rule.runs === undefined) return { done: Math.min(bestRung(p), rung), goal: rung };
  return { done: Math.min(p.runs[rung - 1] ?? 0, rule.runs), goal: rule.runs };
}

/** The highest rung any run has reached; 0 for none. */
export function bestRung(p: CollectionProgress): number {
  let best = p.runs.length;
  while (best > 0 && !p.runs[best - 1]) best--;
  return best;
}

export function isMet(rule: UnlockRule, p: CollectionProgress, ladderLength: number): boolean {
  const { done, goal } = progressOf(rule, p, ladderLength);
  return done >= goal;
}

/** Unlocks every skin whose rule is now met; returns the new progress and the skins it unlocked. */
export function unlock(
  manifest: CoinManifest,
  p: CollectionProgress,
  ladderLength: number,
): { progress: CollectionProgress; unlocked: string[] } {
  const fresh = manifest.skins
    .filter((s) => s.unlock && !p.unlocked.includes(s.id) && isMet(s.unlock, p, ladderLength))
    .map((s) => s.id);
  return {
    progress: fresh.length ? { ...p, unlocked: [...p.unlocked, ...fresh] } : p,
    unlocked: fresh,
  };
}

export function isUnlocked(manifest: CoinManifest, p: CollectionProgress, id: string): boolean {
  const skin = skinOf(manifest, id);
  return !!skin && (isFree(skin) || p.unlocked.includes(id));
}

/** The coin the player is working towards: the first one still locked, in the path's order. */
export interface NextCoin {
  skin: CoinSkin;
  rule: UnlockRule;
  done: number;
  goal: number;
}

/** Null once every coin is collected. */
export function nextCoin(
  manifest: CoinManifest,
  p: CollectionProgress,
  ladderLength: number,
): NextCoin | null {
  for (const skin of manifest.skins) {
    if (!skin.unlock || isUnlocked(manifest, p, skin.id)) continue;
    return { skin, rule: skin.unlock, ...progressOf(skin.unlock, p, ladderLength) };
  }
  return null;
}
