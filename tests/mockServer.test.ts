import { describe, expect, it } from 'vitest';
import { MockServer, type KeyValueStore } from '../src/server/mockServer';
import { ServerError } from '../src/server/protocol';

const memoryStore = (): KeyValueStore => {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

const rejectsWith = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toBeInstanceOf(ServerError);
  await expect(p).rejects.toMatchObject({ code });
};

describe('first pick', () => {
  it('takes the stake and opens a run on a correct pick', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.forceOutcomes('sheriff');
    const res = await server.play({ bet: 1000, pick: 'sheriff' });
    expect(res.flip).toEqual({ pick: 'sheriff', outcome: 'sheriff', won: true });
    expect(res.win).toBe(0);
    expect(res.balance).toBe(99_000);
    expect(res.openRun).toMatchObject({ roundId: res.roundId, bet: 1000, step: 1, prize: 1980 });
  });

  it('keeps the stake on a wrong pick', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.forceOutcomes('outlaw');
    const res = await server.play({ bet: 1000, pick: 'sheriff' });
    expect(res.win).toBe(0);
    expect(res.balance).toBe(99_000);
    expect(res.openRun).toBeNull();
  });

  it('rejects a bet off the typed-bet grid or outside its range', async () => {
    const server = new MockServer();
    // 5.00 to 100.00 in steps of 0.05
    for (const bet of [1234, 100, 495, 10_005, 0, -100, 7.5])
      await rejectsWith(server.play({ bet, pick: 'sheriff' }), 'INVALID_BET');
  });

  it('takes a typed bet on the grid', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.forceOutcomes('outlaw');
    const res = await server.play({ bet: 735, pick: 'sheriff' });
    expect(res.balance).toBe(100_000 - 735);
  });

  it('takes only levels without typed bets in the config', async () => {
    const server = new MockServer({ config: { customBet: null } });
    await rejectsWith(server.play({ bet: 735, pick: 'sheriff' }), 'INVALID_BET');
    expect((await server.init()).config.customBet).toBeNull();
  });

  it('rejects a bet above the balance', async () => {
    const server = new MockServer({ balance: 400 });
    await rejectsWith(server.play({ bet: 500, pick: 'sheriff' }), 'INSUFFICIENT_FUNDS');
  });
});

describe('multiply run', () => {
  it('climbs the ladder and cashes out', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.forceOutcomes('sheriff', 'outlaw');
    const first = await server.play({ bet: 1000, pick: 'sheriff' });
    expect(first.balance).toBe(99_000);
    expect(first.openRun).toMatchObject({ step: 1, prize: 1980 });

    const roundId = first.roundId;
    const second = await server.action({ roundId, type: 'pick', pick: 'outlaw' });
    expect(second.openRun).toMatchObject({ step: 2, prize: 3960 });
    expect(second.win).toBe(0);

    const cash = await server.action({ roundId, type: 'cashout' });
    expect(cash.flip).toBeNull();
    expect(cash.win).toBe(3960);
    expect(cash.balance).toBe(99_000 + 3960);
    expect(cash.openRun).toBeNull();
  });

  it('loses the stake on a wrong pick and closes the run', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.forceOutcomes('sheriff', 'sheriff');
    const first = await server.play({ bet: 1000, pick: 'sheriff' });
    const lost = await server.action({ roundId: first.roundId, type: 'pick', pick: 'outlaw' });
    expect(lost.win).toBe(0);
    expect(lost.openRun).toBeNull();
    expect(lost.balance).toBe(99_000);
    await rejectsWith(
      server.action({ roundId: first.roundId, type: 'cashout' }),
      'ROUND_NOT_FOUND',
    );
  });

  it('pays the top rung by itself', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.forceOutcomes(...Array(8).fill('sheriff'));
    const first = await server.play({ bet: 500, pick: 'sheriff' });
    let res = first;
    for (let i = 0; i < 7; i++)
      res = await server.action({ roundId: first.roundId, type: 'pick', pick: 'sheriff' });
    expect(res.openRun).toBeNull();
    expect(res.win).toBe(126_720); // 5 FUN x 253.44
    expect(res.balance).toBe(100_000 - 500 + 126_720);
  });

  it('refuses a new round while a run is open', async () => {
    const server = new MockServer();
    server.forceOutcomes('sheriff');
    await server.play({ bet: 500, pick: 'sheriff' });
    await rejectsWith(server.play({ bet: 500, pick: 'sheriff' }), 'ROUND_IN_PROGRESS');
  });
});

describe('recovery and failures', () => {
  it('returns an open run after a reload', async () => {
    const store = memoryStore();
    const before = new MockServer({ store, balance: 100_000 });
    before.forceOutcomes('outlaw');
    const first = await before.play({ bet: 1000, pick: 'outlaw' });

    const after = new MockServer({ store });
    const init = await after.init();
    expect(init.balance).toBe(99_000);
    expect(init.openRun).toEqual(first.openRun);
  });

  it('changes nothing when a request fails', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.failNext('NETWORK');
    await rejectsWith(server.play({ bet: 100, pick: 'sheriff' }), 'NETWORK');
    expect((await server.init()).balance).toBe(100_000);
  });

  it('does not let the client edit server state through a response', async () => {
    const server = new MockServer();
    const init = await server.init();
    init.config.bets.push(1);
    expect((await server.init()).config.bets).not.toContain(1);
  });
});

describe('QA controls', () => {
  it('forces a win or a loss against whatever the player picks', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.forceOutcomes('win', 'lose');
    const won = await server.play({ bet: 500, pick: 'outlaw' });
    expect(won.flip).toEqual({ pick: 'outlaw', outcome: 'outlaw', won: true });
    const lost = await server.action({ roundId: won.roundId, type: 'pick', pick: 'outlaw' });
    expect(lost.flip).toEqual({ pick: 'outlaw', outcome: 'sheriff', won: false });
    expect(server.snapshot().forced).toEqual([]);
  });

  it('settles a request whose answer it then loses', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.forceOutcomes('sheriff');
    server.failNext('NETWORK', 'after');
    await rejectsWith(server.play({ bet: 1000, pick: 'sheriff' }), 'NETWORK');
    // the stake is taken and the run is open: the client must learn it from a resync
    const init = await server.init();
    expect(init.balance).toBe(99_000);
    expect(init.openRun).toMatchObject({ step: 1, prize: 1980 });
    expect(server.snapshot().failure).toBeNull();
  });

  it('fails every request while offline', async () => {
    const server = new MockServer();
    server.setOffline(true);
    await rejectsWith(server.init(), 'NETWORK');
    await rejectsWith(server.init(), 'NETWORK');
    server.setOffline(false);
    await expect(server.init()).resolves.toMatchObject({ balance: 100_000 });
  });

  it('opens a run at a rung and staked once', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.openRunAt(3, 1000);
    expect(server.snapshot()).toMatchObject({
      balance: 99_000,
      openRun: { bet: 1000, step: 3, prize: 7920 },
    });
    // moving an open run keeps its bet and takes no second stake
    server.openRunAt(7, 100);
    expect(server.snapshot()).toMatchObject({
      balance: 99_000,
      openRun: { bet: 1000, step: 7, prize: 126_720 },
    });
    server.forceOutcomes('win');
    const { roundId } = server.snapshot().openRun ?? { roundId: '' };
    const top = await server.action({ roundId, type: 'pick', pick: 'sheriff' });
    expect(top).toMatchObject({ win: 253_440, openRun: null, balance: 99_000 + 253_440 });
  });

  it('refuses a rung the run cannot stay open at, or a stake it cannot take', () => {
    const server = new MockServer({ balance: 500 });
    expect(() => server.openRunAt(8, 100)).toThrow(RangeError);
    expect(() => server.openRunAt(0, 100)).toThrow(RangeError);
    expect(() => server.openRunAt(1, 123)).toThrow(ServerError);
    expect(() => server.openRunAt(1, 1000)).toThrow(ServerError);
    expect(server.snapshot()).toMatchObject({ balance: 500, openRun: null });
  });

  it('refuses a balance that is not whole minor units', () => {
    const server = new MockServer();
    expect(() => server.setBalance(1.5)).toThrow(RangeError);
    expect(() => server.setBalance(-1)).toThrow(RangeError);
  });

  it('resets to a first visit and tells its listeners about every change', async () => {
    const store = memoryStore();
    const server = new MockServer({ store, balance: 100_000 });
    let changes = 0;
    server.subscribe(() => changes++);
    server.setBalance(5000);
    server.openRunAt(1, 500);
    server.forceOutcomes('win');
    server.failNext('INTERNAL');
    server.setOffline(true);
    server.setLatency(500);
    expect(changes).toBe(6);

    server.reset();
    expect(server.snapshot()).toEqual({
      balance: 100_000,
      openRun: null,
      forced: [],
      failure: null,
      offline: false,
      latencyMs: 500,
    });
    expect((await new MockServer({ store }).init()).openRun).toBeNull();
  });
});
