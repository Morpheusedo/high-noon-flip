/**
 * What a typed amount means for the bet, before anything is sent: the stake, a
 * stake rounded onto the server's grid (shown to the player first, never set
 * silently), or why it cannot be the bet. An amount outside the range is not
 * refused: it becomes the nearest stake the server takes, the lowest or the
 * highest, and the tab shows it as the bet. Kept apart from the field so it can
 * be tested; the server still has the last word.
 */
import { isValidBet, snapToGrid } from '../../server/bets';
import type { GameConfig, Minor } from '../../server/protocol';

export type TypedCheck =
  | { kind: 'bet'; stake: Minor }
  | { kind: 'rounded'; stake: Minor }
  | { kind: 'notAmount' | 'balance' };

/** `amount` is the parsed field, null when it is not a number in the player's language. */
export function checkTypedBet(
  config: GameConfig,
  balance: Minor,
  amount: Minor | null,
): TypedCheck {
  const custom = config.customBet;
  if (amount === null || amount === 0 || !custom) return { kind: 'notAmount' };
  const clamped = clampToRange(config, amount);
  if (clamped !== null)
    return clamped > balance ? { kind: 'balance' } : { kind: 'bet', stake: clamped };
  // a level is taken as it is; anything else lands on the server's grid
  const stake = isValidBet(config, amount) ? amount : (snapToGrid(config, amount) ?? amount);
  if (stake > balance) return { kind: 'balance' };
  return stake === amount ? { kind: 'bet', stake } : { kind: 'rounded', stake };
}

/**
 * The nearest stake the server takes for an amount outside the typed range: the
 * lowest one above it, or the highest one below it (a level or the top of the
 * grid). Null for an amount inside the range or a level.
 */
function clampToRange(config: GameConfig, amount: Minor): Minor | null {
  const custom = config.customBet;
  if (!custom || isValidBet(config, amount)) return null;
  if (amount < custom.min) return Math.min(custom.min, ...config.bets.filter((b) => b >= amount));
  if (amount > custom.max)
    return Math.max(
      snapToGrid(config, custom.max) ?? custom.min,
      ...config.bets.filter((b) => b <= amount),
    );
  return null;
}
