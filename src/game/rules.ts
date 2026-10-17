/**
 * The figures the rules screen shows, all taken from the server's config. The
 * client does not hold the math: if the provider changes a payout or the RTP,
 * the rules follow with no client release.
 */
import { betLimits } from '../server/bets';
import type { CustomBet, GameConfig, Minor, OpenRun } from '../server/protocol';

export interface RulesFacts {
  /** Multiplier and prize at `bet` per rung; rung i is reached after i + 1 correct picks. */
  ladder: { picks: number; multiplier: number; prize: Minor }[];
  /** The lowest and highest stake, levels and typed amounts together. */
  minBet: Minor;
  maxBet: Minor;
  /** The range of typed stakes, when the server takes them. */
  customBet: CustomBet | null;
  rtp: number;
  /** The top rung's multiplier, and what it pays at the highest stake. */
  maxWin: { multiplier: number; amount: Minor };
}

export function rulesFacts(config: GameConfig, bet: Minor): RulesFacts {
  const { min: minBet, max: maxBet } = betLimits(config);
  const top = Math.max(...config.ladder);
  return {
    ladder: config.ladder.map((multiplier, i) => ({
      picks: i + 1,
      multiplier,
      prize: payout(bet, multiplier),
    })),
    minBet,
    maxBet,
    customBet: config.customBet ?? null,
    rtp: config.rtp,
    maxWin: { multiplier: top, amount: payout(maxBet, top) },
  };
}

/**
 * What the next correct pick of an open run would pay, and whether it is the top
 * rung, which pays out by itself. Null when nothing is left to climb.
 *
 * The client computes money here that it shows during play; the provider is asked
 * to send it in `OpenRun` (open question 9), and then this becomes a read.
 */
export function nextPrize(
  config: GameConfig,
  run: OpenRun,
): { amount: Minor; top: boolean } | null {
  const multiplier = config.ladder[run.step];
  if (multiplier === undefined) return null;
  return { amount: payout(run.bet, multiplier), top: run.step === config.ladder.length - 1 };
}

/**
 * Bet times a multiplier, rounded down to the minor unit as the server pays it.
 * The multiplier is made a whole number of ten-thousandths first, so 1.98 does not
 * turn into 1.9799999 and floor a cent away.
 */
export function payout(bet: Minor, multiplier: number): Minor {
  return Math.floor((bet * Math.round(multiplier * 10_000)) / 10_000);
}
