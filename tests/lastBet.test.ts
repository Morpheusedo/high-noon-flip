import { describe, expect, it } from 'vitest';
import { createLastBet, readLastBet, savedBet, withBet } from '../src/game/lastBet';
import { RoundModel } from '../src/game/model/RoundModel';
import { MockServer } from '../src/server/mockServer';
import { memoryStore } from '../src/shell/storage';

/** The model a returning player gets: the saved bet if the config still takes it. */
async function returning(saved: unknown, server = new MockServer({ balance: 1_000_000 })) {
  const storage = memoryStore();
  storage.setItem('hnf.bet', JSON.stringify(saved));
  const init = await server.init();
  const last = createLastBet(storage).get();
  return { model: new RoundModel(server, init, savedBet(last, init.config)), init };
}

describe('the last bet', () => {
  it('is saved and read back on the next visit', async () => {
    const storage = memoryStore();
    const last = createLastBet(storage);
    expect(last.get()).toBeNull();
    const { config } = await new MockServer().init();
    last.set(withBet(last.get(), 2500, config));
    expect(createLastBet(storage).get()).toEqual({ amount: 2500, currency: 'FUN' });
  });

  it('starts a returning player at their last bet', async () => {
    const { model, init } = await returning({ amount: 2500, currency: 'FUN' });
    expect(init.config.defaultBet).not.toBe(2500);
    expect(model.state.bet).toBe(2500);
    // a typed amount between two levels, on the grid of typed stakes
    expect((await returning({ amount: 1235, currency: 'FUN' })).model.state.bet).toBe(1235);
  });

  it('falls back to the default bet for a bet the config does not take', async () => {
    const server = new MockServer({ balance: 1_000_000 });
    const { config } = await server.init();
    const max = config.customBet?.max ?? Math.max(...config.bets);
    // another currency, out of the typed range, off the grid of typed stakes, not a stake
    for (const saved of [
      { amount: 2500, currency: 'EUR' },
      { amount: max + 100, currency: 'FUN' },
      { amount: (config.customBet?.min ?? 0) + 2, currency: 'FUN' },
      { amount: -100, currency: 'FUN' },
    ])
      expect((await returning(saved, server)).model.state.bet).toBe(config.defaultBet);
  });

  it('falls back to the default bet when the levels changed and typed bets are off', async () => {
    const server = new MockServer({ balance: 1_000_000, config: { customBet: null } });
    const { config } = await server.init();
    const gone = { amount: Math.max(...config.bets) + 1, currency: 'FUN' };
    expect((await returning(gone, server)).model.state.bet).toBe(config.defaultBet);
    const level = config.bets[1] ?? 0;
    expect((await returning({ amount: level, currency: 'FUN' }, server)).model.state.bet).toBe(
      level,
    );
  });

  it('lets an open run keep its own bet', async () => {
    const server = new MockServer({ balance: 1_000_000 });
    const { config } = await server.init();
    const runBet = config.bets[2] ?? 0;
    expect(runBet).not.toBe(2500);
    server.openRunAt(2, runBet);
    const { model } = await returning({ amount: 2500, currency: 'FUN' }, server);
    expect(model.state.openRun?.bet).toBe(runBet);
    expect(model.state.bet).toBe(runBet);
  });

  it('reads odd or corrupt data as no bet', () => {
    expect(readLastBet('garbage')).toBeNull();
    expect(readLastBet({ amount: 1.5, currency: 'FUN' })).toBeNull();
    expect(readLastBet({ amount: 100, currency: 3 })).toBeNull();
    const storage = memoryStore();
    storage.setItem('hnf.bet', '{not json');
    expect(createLastBet(storage).get()).toBeNull();
  });
});
