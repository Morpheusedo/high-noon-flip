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

describe('instant mode', () => {
  it('pays 1.98x on a correct pick', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.forceOutcomes('sheriff');
    const res = await server.play({ mode: 'instant', bet: 1000, pick: 'sheriff' });
    expect(res.flip).toEqual({ pick: 'sheriff', outcome: 'sheriff', won: true });
    expect(res.win).toBe(1980);
    expect(res.balance).toBe(100_000 - 1000 + 1980);
    expect(res.openRun).toBeNull();
  });

  it('keeps the stake on a wrong pick', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.forceOutcomes('outlaw');
    const res = await server.play({ mode: 'instant', bet: 1000, pick: 'sheriff' });
    expect(res.win).toBe(0);
    expect(res.balance).toBe(99_000);
  });

  it('rejects a bet that is not in the config', async () => {
    const server = new MockServer();
    await rejectsWith(server.play({ mode: 'instant', bet: 123, pick: 'sheriff' }), 'INVALID_BET');
  });

  it('rejects a bet above the balance', async () => {
    const server = new MockServer({ balance: 50 });
    await rejectsWith(
      server.play({ mode: 'instant', bet: 100, pick: 'sheriff' }),
      'INSUFFICIENT_FUNDS',
    );
  });
});

describe('multiply mode', () => {
  it('climbs the ladder and cashes out', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.forceOutcomes('sheriff', 'outlaw');
    const first = await server.play({ mode: 'multiply', bet: 1000, pick: 'sheriff' });
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
    const first = await server.play({ mode: 'multiply', bet: 1000, pick: 'sheriff' });
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
    const first = await server.play({ mode: 'multiply', bet: 100, pick: 'sheriff' });
    let res = first;
    for (let i = 0; i < 7; i++)
      res = await server.action({ roundId: first.roundId, type: 'pick', pick: 'sheriff' });
    expect(res.openRun).toBeNull();
    expect(res.win).toBe(25_344); // 1 FUN x 253.44
    expect(res.balance).toBe(100_000 - 100 + 25_344);
  });

  it('refuses a new round while a run is open', async () => {
    const server = new MockServer();
    server.forceOutcomes('sheriff');
    await server.play({ mode: 'multiply', bet: 100, pick: 'sheriff' });
    await rejectsWith(
      server.play({ mode: 'instant', bet: 100, pick: 'sheriff' }),
      'ROUND_IN_PROGRESS',
    );
  });
});

describe('recovery and failures', () => {
  it('returns an open run after a reload', async () => {
    const store = memoryStore();
    const before = new MockServer({ store, balance: 100_000 });
    before.forceOutcomes('outlaw');
    const first = await before.play({ mode: 'multiply', bet: 1000, pick: 'outlaw' });

    const after = new MockServer({ store });
    const init = await after.init();
    expect(init.balance).toBe(99_000);
    expect(init.openRun).toEqual(first.openRun);
  });

  it('changes nothing when a request fails', async () => {
    const server = new MockServer({ balance: 100_000 });
    server.failNext('NETWORK');
    await rejectsWith(server.play({ mode: 'instant', bet: 100, pick: 'sheriff' }), 'NETWORK');
    expect((await server.init()).balance).toBe(100_000);
  });

  it('does not let the client edit server state through a response', async () => {
    const server = new MockServer();
    const init = await server.init();
    init.config.bets.push(1);
    expect((await server.init()).config.bets).not.toContain(1);
  });
});
