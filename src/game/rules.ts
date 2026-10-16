/**
 * The figures the rules screen shows, all taken from the server's config. The
 * client does not hold the math: if the provider changes a payout or the RTP,
 * the rules follow with no client release.
 */
import type { GameConfig, Minor } from '../server/protocol';

export interface RulesFacts {
  /** Multiplier and prize at `bet` per rung; rung i is reached after i + 1 correct picks. */
  ladder: { picks: number; multiplier: number; prize: Minor }[];
  minBet: Minor;
  maxBet: Minor;
  rtp: number;
  /** The top rung's multiplier, and what it pays at the highest bet. */
  maxWin: { multiplier: number; amount: Minor };
}

export function rulesFacts(config: GameConfig, bet: Minor): RulesFacts {
  const minBet = config.bets[0] ?? 0;
  const maxBet = config.bets.at(-1) ?? 0;
  const top = Math.max(...config.ladder);
  return {
    ladder: config.ladder.map((multiplier, i) => ({
      picks: i + 1,
      multiplier,
      prize: payout(bet, multiplier),
    })),
    minBet,
    maxBet,
    rtp: config.rtp,
    maxWin: { multiplier: top, amount: payout(maxBet, top) },
  };
}

/**
 * Bet times a multiplier, rounded down to the minor unit as the server pays it.
 * The multiplier is made a whole number of ten-thousandths first, so 1.98 does not
 * turn into 1.9799999 and floor a cent away.
 */
export function payout(bet: Minor, multiplier: number): Minor {
  return Math.floor((bet * Math.round(multiplier * 10_000)) / 10_000);
}
