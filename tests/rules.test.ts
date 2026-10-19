import { describe, expect, it } from 'vitest';
import { nextPrize, payout, rulesFacts } from '../src/game/rules';
import { MockServer } from '../src/server/mockServer';

describe('rules facts', () => {
  it('come from the config the server sends', async () => {
    const { config } = await new MockServer().init();
    const facts = rulesFacts(config, 500);
    expect(facts.ladder.map((r) => r.prize)).toEqual([
      990, 1980, 3960, 7920, 15840, 31680, 63360, 126720,
    ]);
    expect(facts.ladder.at(-1)?.picks).toBe(8);
    // the demo takes typed bets from its lowest level, 5.00
    expect([facts.minBet, facts.maxBet]).toEqual([500, 10000]);
    expect(facts.customBet).toEqual({ min: 500, max: 10_000, step: 5 });
    expect(facts.maxWin).toEqual({ multiplier: 253.44, amount: 2_534_400 });
  });

  it('take the limits from the levels alone without typed bets', async () => {
    const { config } = await new MockServer({ config: { customBet: null } }).init();
    const facts = rulesFacts(config, 500);
    expect([facts.minBet, facts.maxBet]).toEqual([500, 10000]);
    expect(facts.customBet).toBeNull();
  });

  it('count the maximum win from a typed bet above the top level', async () => {
    const { config } = await new MockServer({
      config: { customBet: { min: 10, max: 20_000, step: 1 } },
    }).init();
    const facts = rulesFacts(config, 500);
    expect(facts.maxBet).toBe(20_000);
    expect(facts.maxWin.amount).toBe(5_068_800);
  });

  it('round payouts down to the minor unit without float error', () => {
    expect(payout(100, 1.98)).toBe(198);
    expect(payout(1, 1.98)).toBe(1);
    expect(payout(3, 1.15)).toBe(3);
    expect(payout(10_000, 253.44)).toBe(2_534_400);
  });

  it('name the next prize of a run and the top rung that pays by itself', async () => {
    const { config } = await new MockServer().init();
    const run = (step: number) => ({ roundId: 'r', bet: 200, step, prize: 0 });
    expect(nextPrize(config, run(1))).toEqual({ amount: 792, top: false });
    expect(nextPrize(config, run(7))).toEqual({ amount: 50_688, top: true });
    expect(nextPrize(config, run(8))).toBeNull();
  });
});
