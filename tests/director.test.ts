import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { celebration, startDirector, type Presenter } from '../src/game/director';
import { RoundModel } from '../src/game/model/RoundModel';
import { MockServer, type MockServerOptions } from '../src/server/mockServer';
import { createSettings, type Speed } from '../src/shell/settings';

const delay = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** A scene that logs what it is asked to do; its animations take exactly the time asked. */
function fakeScene(reducedMotion = false) {
  const calls: string[] = [];
  const scene: Presenter = {
    reducedMotion,
    cock: (ms) => (calls.push(`cock ${ms}`), delay(ms)),
    release: () => calls.push('release'),
    fire: (spinMs, pace) => calls.push(`fire ${spinMs} ${pace}`),
    flip: (side, ms, turns) => (calls.push(`flip ${side} ${ms} ${turns}`), delay(ms)),
    win: (level) => calls.push(`win ${level}`),
    lose: () => calls.push('lose'),
    wait: delay,
  };
  return { scene, calls };
}

async function setup(
  options: { server?: MockServerOptions; speed?: Speed; reducedMotion?: boolean } = {},
) {
  const server = new MockServer({ balance: 100_000, ...options.server });
  const model = new RoundModel(server, await server.init());
  const settings = createSettings();
  settings.set({ speed: options.speed ?? 1 });
  const { scene, calls } = fakeScene(options.reducedMotion);
  const stop = startDirector(model, scene, settings, () => Date.now());
  return { server, model, settings, calls, stop, phase: () => model.state.phase.name };
}

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('director', () => {
  it('cocks, fires, flies the coin to the outcome, then shows the result', async () => {
    const { server, model, calls, phase } = await setup();
    server.forceOutcomes('outlaw');
    await model.pick('outlaw');
    expect(calls).toEqual(['cock 230']);
    expect(phase()).toBe('revealing');

    await advance(229);
    expect(calls).toEqual(['cock 230']);
    await advance(1);
    expect(calls).toEqual(['cock 230', 'fire 900 1', 'flip outlaw 1900 6']);

    await advance(1900);
    expect(phase()).toBe('result');
    expect(calls.at(-1)).toBe('win 0');

    await advance(1899);
    expect(phase()).toBe('result');
    await advance(1);
    expect(phase()).toBe('idle');
  });

  it('dims and holds a loss for its own time', async () => {
    const { server, model, calls, phase } = await setup();
    server.forceOutcomes('sheriff');
    await model.pick('outlaw');
    await advance(230 + 1900);
    expect(calls.at(-1)).toBe('lose');
    await advance(1299);
    expect(phase()).toBe('result');
    await advance(1);
    expect(phase()).toBe('idle');
  });

  it('plays faster at 4x', async () => {
    const { server, model, calls, phase } = await setup({ speed: 4 });
    server.forceOutcomes('sheriff');
    await model.pick('sheriff');
    await advance(55);
    expect(calls).toContain('flip sheriff 456 1');
    await advance(456 + 456);
    expect(phase()).toBe('idle');
  });

  it('keeps normal speed where the market bans turbo', async () => {
    const { model, calls } = await setup({
      speed: 4,
      server: { jurisdiction: { turboAllowed: false } },
    });
    await model.pick('sheriff');
    await advance(230);
    expect(calls.at(-1)).toMatch(/^flip \w+ 1900 6$/);
  });

  it('stretches the result to the market minimum round time', async () => {
    const { model, phase } = await setup({ server: { jurisdiction: { minRoundMs: 5000 } } });
    await model.pick('sheriff');
    await advance(4999);
    expect(phase()).toBe('result');
    await advance(1);
    expect(phase()).toBe('idle');
  });

  it('cuts the flight short with reduced motion', async () => {
    const { model, calls } = await setup({ reducedMotion: true });
    await model.pick('sheriff');
    await advance(0);
    expect(calls.at(-1)).toMatch(/^flip \w+ 500 1$/);
  });

  it('applies a new speed from the next round', async () => {
    const { model, settings, calls } = await setup();
    await model.pick('sheriff');
    settings.set({ speed: 2 });
    await advance(230);
    expect(calls.at(-1)).toMatch(/ 1900 6$/);
    await advance(1900 + 1900);
    await model.pick('sheriff');
    await advance(115);
    expect(calls.at(-1)).toMatch(/ 950 3$/);
  });

  it('lets the hammer down when the request fails', async () => {
    const { server, model, calls, phase } = await setup();
    server.failNext('NETWORK');
    await model.pick('sheriff');
    expect(phase()).toBe('error');
    expect(calls).toEqual(['cock 230', 'release']);
    await advance(5000);
    expect(calls).toEqual(['cock 230', 'release']);
    expect(phase()).toBe('error');
  });

  it('celebrates a cash out by the length of the run', async () => {
    const { server, model, calls, phase } = await setup();
    model.setMode('multiply');
    server.forceOutcomes('sheriff', 'sheriff');
    for (let i = 0; i < 2; i++) {
      await model.pick('sheriff');
      await advance(230 + 1900 + 1100);
      expect(phase()).toBe('idle');
    }
    expect(calls.filter((c) => c.startsWith('win'))).toEqual(['win 0', 'win 1']);
    await model.cashOut();
    expect(calls.at(-1)).toBe('win 3');
    await advance(1900);
    expect(phase()).toBe('idle');
  });

  it('reports nothing once stopped', async () => {
    const { model, stop, phase } = await setup();
    await model.pick('sheriff');
    stop();
    await advance(10_000);
    expect(phase()).toBe('revealing');
  });
});

describe('celebration', () => {
  it('spreads any number of bet levels over the win effect sizes', async () => {
    const bets = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
    const server = new MockServer({ config: { bets, defaultBet: 1100 } });
    const model = new RoundModel(server, await server.init());
    const flip = { pick: 'sheriff', outcome: 'sheriff', won: true } as const;
    const win = { kind: 'win', amount: 1 } as const;
    expect(celebration(model.state, win, flip, 0)).toEqual({ kind: 'win', level: 3 });
    model.setBet(2000);
    expect(celebration(model.state, win, flip, 0).level).toBe(5);
    model.setBet(100);
    expect(celebration(model.state, win, flip, 0).level).toBe(0);
  });
});
