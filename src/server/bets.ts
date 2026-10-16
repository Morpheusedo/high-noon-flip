/**
 * Which stakes the server takes. The client and `MockServer` both ask
 * `isValidBet`, so the bet the player sees accepted is the bet the server
 * accepts; a provider adapter checks its own RGS rules against the same config.
 */
import type { GameConfig, Minor } from './protocol';

/** A level from `bets`, or with `customBet` any amount inside its range on its grid. */
export function isValidBet(config: GameConfig, bet: Minor): boolean {
  if (!Number.isSafeInteger(bet) || bet <= 0) return false;
  if (config.bets.includes(bet)) return true;
  const custom = config.customBet;
  return (
    !!custom && bet >= custom.min && bet <= custom.max && (bet - custom.min) % custom.step === 0
  );
}

/** The lowest and the highest stake the server takes, levels and typed amounts together. */
export function betLimits(config: GameConfig): { min: Minor; max: Minor } {
  const custom = config.customBet;
  const levels = config.bets;
  const min = Math.min(...levels, ...(custom ? [custom.min] : []));
  const max = Math.max(...levels, ...(custom ? [custom.max] : []));
  return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 };
}

/**
 * A typed amount inside the custom range, rounded down onto its grid, as the
 * server would not round it for us. Null outside the range or without custom bets.
 */
export function snapToGrid(config: GameConfig, amount: Minor): Minor | null {
  const custom = config.customBet;
  if (!custom || amount < custom.min || amount > custom.max) return null;
  return custom.min + Math.floor((amount - custom.min) / custom.step) * custom.step;
}

/**
 * The level one step up or down from `bet`. From a typed amount between two
 * levels, the next level above or below it. Null past either end.
 */
export function nextLevel(levels: readonly Minor[], bet: Minor, dir: 1 | -1): Minor | null {
  const next = dir > 0 ? levels.find((b) => b > bet) : levels.filter((b) => b < bet).at(-1);
  return next ?? null;
}
