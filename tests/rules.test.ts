import { describe, expect, it } from 'vitest';
import { payout, rulesFacts } from '../src/game/rules';
import { MockServer } from '../src/server/mockServer';

describe('rules facts', () => {
  it('come from the config the server sends', async () => {
    const { config } = await new MockServer().init();
    const facts = rulesFacts(config, 100);
    expect(facts.instantMultiplier).toBe(1.98);
    expect(facts.ladder.map((r) => r.prize)).toEqual([
      198, 396, 792, 1584, 3168, 6336, 12672, 25344,
    ]);
    expect(facts.ladder.at(-1)?.picks).toBe(8);
    expect([facts.minBet, facts.maxBet]).toEqual([100, 10000]);
    expect(facts.maxWin).toEqual({ multiplier: 253.44, amount: 2_534_400 });
  });

  it('round payouts down to the minor unit without float error', () => {
    expect(payout(100, 1.98)).toBe(198);
    expect(payout(1, 1.98)).toBe(1);
    expect(payout(3, 1.15)).toBe(3);
    expect(payout(10_000, 253.44)).toBe(2_534_400);
  });
});
