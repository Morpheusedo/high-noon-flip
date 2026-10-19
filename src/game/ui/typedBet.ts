/**
 * What a typed amount means for the bet, before anything is sent: the stake, a
 * stake rounded onto the server's grid (shown to the player first, never set
 * silently), or why it cannot be the bet. Kept apart from the field so it can
 * be tested; the server still has the last word.
 */
import { isValidBet, snapToGrid } from '../../server/bets';
import type { GameConfig, Minor } from '../../server/protocol';

export type TypedCheck =
  | { kind: 'bet'; stake: Minor }
  | { kind: 'rounded'; stake: Minor }
  | { kind: 'notAmount' | 'min' | 'max' | 'balance' };

/** `amount` is the parsed field, null when it is not a number in the player's language. */
export function checkTypedBet(
  config: GameConfig,
  balance: Minor,
  amount: Minor | null,
): TypedCheck {
  const custom = config.customBet;
  if (amount === null || amount === 0 || !custom) return { kind: 'notAmount' };
  const exact = isValidBet(config, amount);
  if (!exact && amount < custom.min) return { kind: 'min' };
  if (!exact && amount > custom.max) return { kind: 'max' };
  // a level is taken as it is; anything else lands on the server's grid
  const stake = exact ? amount : (snapToGrid(config, amount) ?? amount);
  if (stake > balance) return { kind: 'balance' };
  return stake === amount ? { kind: 'bet', stake } : { kind: 'rounded', stake };
}
