import { describe, expect, it, vi } from 'vitest';
import { affordableBet, canCashOut, canPick, RoundModel } from '../src/game/model/RoundModel';
import { MockServer } from '../src/server/mockServer';

async function setup(options: ConstructorParameters<typeof MockServer>[0] = {}) {
  const server = new MockServer({ balance: 100_000, ...options });
  const model = new RoundModel(server, await server.init());
  return { server, model };
}

/** Plays the director's part: land the coin, then leave the result screen. */
function present(model: RoundModel) {
  model.finishReveal();
  const result = model.state.phase;
  model.finishResult();
  return result;
}

describe('instant round', () => {
  it('goes idle → requesting → revealing → result → idle', async () => {
    const { server, model } = await setup();
    server.forceOutcomes('sheriff');
    const phases: string[] = [];
    model.store.subscribe((s) => phases.push(s.phase.name));

    await model.pick('sheriff');
    expect(model.state.phase).toEqual({
      name: 'revealing',
      flip: { pick: 'sheriff', outcome: 'sheriff', won: true },
    });
    // the win is known but not shown until the coin lands
    expect(model.state.balance).toBe(99_900);

    const result = present(model);
    expect(result).toMatchObject({ name: 'result', outcome: { kind: 'win', amount: 198 } });
    expect(phases).toEqual(['requesting', 'revealing', 'result', 'idle']);
    expect(model.state.balance).toBe(100_098);
    expect(model.state.history).toEqual(['sheriff']);
  });

  it('reports the stake on a loss', async () => {
    const { server, model } = await setup();
    server.forceOutcomes('outlaw');
    await model.pick('sheriff');
    expect(present(model)).toMatchObject({ outcome: { kind: 'lose', amount: 100 } });
    expect(model.state.balance).toBe(99_900);
  });

  it('sends one bet for a double tap', async () => {
    const { server, model } = await setup();
    const play = vi.spyOn(server, 'play');
    await Promise.all([model.pick('sheriff'), model.pick('sheriff')]);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('stops a bet the balance cannot cover without asking the server', async () => {
    const { server, model } = await setup({ balance: 50 });
    const play = vi.spyOn(server, 'play');
    expect(canPick(model.state)).toBe(false);
    await model.pick('sheriff');
    expect(play).not.toHaveBeenCalled();
    expect(model.state.phase).toEqual({ name: 'error', code: 'INSUFFICIENT_FUNDS', fatal: false });
    await model.dismissError();
    expect(model.state.phase.name).toBe('idle');
  });

  it('learns the real balance when the server refuses a bet the client thought it could cover', async () => {
    const { server, model } = await setup();
    server.setBalance(50);
    model.setBet(500);
    await model.pick('sheriff');
    expect(model.state.phase).toMatchObject({ name: 'error', code: 'INSUFFICIENT_FUNDS' });
    await model.dismissError();
    expect(model.state.phase.name).toBe('idle');
    expect(model.state.balance).toBe(50);
    expect(affordableBet(model.state)).toBeNull();
  });

  it('accepts only bets from the config', async () => {
    const { model } = await setup();
    model.setBet(1000);
    model.setBet(123);
    expect(model.state.bet).toBe(1000);
  });
});

describe('multiply run', () => {
  it('climbs, locks the setup and cashes out', async () => {
    const { server, model } = await setup();
    server.forceOutcomes('sheriff', 'outlaw');
    model.setMode('multiply');
    model.setBet(1000);

    await model.pick('sheriff');
    expect(present(model)).toMatchObject({
      outcome: { kind: 'step', prize: 1980, multiplier: 1.98 },
    });
    expect(model.state.balance).toBe(99_000);
    expect(canCashOut(model.state)).toBe(true);

    model.setBet(100);
    model.setMode('instant');
    expect(model.state).toMatchObject({ bet: 1000, mode: 'multiply' });

    await model.pick('outlaw');
    expect(present(model)).toMatchObject({ outcome: { kind: 'step', prize: 3960 } });

    await model.cashOut();
    // a cash out has no flip, so it goes straight to the result
    expect(model.state.phase).toMatchObject({
      name: 'result',
      outcome: { kind: 'win', amount: 3960 },
    });
    model.finishResult();
    expect(model.state.openRun).toBeNull();
    expect(model.state.balance).toBe(99_000 + 3960);
  });

  it('loses the stake, not the prize, on a wrong pick', async () => {
    const { server, model } = await setup();
    server.forceOutcomes('sheriff', 'sheriff');
    model.setMode('multiply');
    await model.pick('sheriff');
    present(model);
    await model.pick('outlaw');
    expect(present(model)).toMatchObject({ outcome: { kind: 'lose', amount: 100 } });
    expect(model.state.openRun).toBeNull();
  });

  it('resumes a run left open in the last session', async () => {
    const store = new Map<string, string>();
    const kv = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    const first = await setup({ store: kv });
    first.server.forceOutcomes('outlaw');
    first.model.setMode('multiply');
    first.model.setBet(500);
    await first.model.pick('outlaw');

    const server = new MockServer({ store: kv });
    const model = new RoundModel(server, await server.init());
    expect(model.state).toMatchObject({
      mode: 'multiply',
      bet: 500,
      openRun: { step: 1, prize: 990 },
    });
    expect(canCashOut(model.state)).toBe(true);
  });
});

describe('errors', () => {
  it('puts the stake back on screen and resyncs after a network error', async () => {
    const { server, model } = await setup();
    server.failNext('NETWORK');
    await model.pick('sheriff');
    expect(model.state.phase).toEqual({ name: 'error', code: 'NETWORK', fatal: false });
    expect(model.state.balance).toBe(100_000);

    const init = vi.spyOn(server, 'init');
    await model.dismissError();
    expect(init).toHaveBeenCalledTimes(1);
    expect(model.state.phase.name).toBe('idle');
  });

  it('keeps an open run after a failed pick', async () => {
    const { server, model } = await setup();
    server.forceOutcomes('sheriff');
    model.setMode('multiply');
    await model.pick('sheriff');
    present(model);

    server.failNext('NETWORK');
    await model.pick('sheriff');
    await model.dismissError();
    expect(model.state.openRun).toMatchObject({ step: 1 });
  });

  it('resumes a run whose answer was lost after the server settled it', async () => {
    const { server, model } = await setup();
    server.forceOutcomes('sheriff');
    server.failNext('NETWORK', 'after');
    model.setMode('multiply');
    model.setBet(1000);
    await model.pick('sheriff');
    expect(model.state.phase).toMatchObject({ name: 'error', code: 'NETWORK' });
    expect(model.state.balance).toBe(100_000);

    await model.dismissError();
    expect(model.state).toMatchObject({
      phase: { name: 'idle' },
      balance: 99_000,
      openRun: { step: 1, prize: 1980 },
    });
  });

  it('cannot dismiss an expired session', async () => {
    const { server, model } = await setup();
    server.failNext('SESSION_EXPIRED');
    await model.pick('sheriff');
    await model.dismissError();
    expect(model.state.phase).toEqual({ name: 'error', code: 'SESSION_EXPIRED', fatal: true });
  });
});

describe('refresh', () => {
  it('picks up a balance and a run changed on the server', async () => {
    const { server, model } = await setup();
    server.setBalance(50_000);
    server.openRunAt(4, 500);
    await model.refresh();
    expect(model.state).toMatchObject({
      phase: { name: 'idle' },
      balance: 49_500,
      mode: 'multiply',
      bet: 500,
      openRun: { step: 4, prize: 7920 },
    });
  });

  it('waits for the round to end', async () => {
    const { server, model } = await setup();
    server.forceOutcomes('sheriff');
    await model.pick('sheriff');
    const init = vi.spyOn(server, 'init');
    await model.refresh();
    expect(init).not.toHaveBeenCalled();
    expect(model.state.phase.name).toBe('revealing');
  });

  it('shows the error when the server does not answer', async () => {
    const { server, model } = await setup();
    server.failNext('NETWORK');
    await model.refresh();
    expect(model.state.phase).toMatchObject({ name: 'error', code: 'NETWORK' });
  });
});
