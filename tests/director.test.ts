import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { celebration, MAX_WIN_LEVEL, startDirector, type Presenter } from '../src/game/director';
import { RoundModel } from '../src/game/model/RoundModel';
import { MockServer, type MockServerOptions } from '../src/server/mockServer';
import type { RoundSounds } from '../src/game/sound';
import { createSettings, type Speed } from '../src/shell/settings';
import { Store } from '../src/shell/store';
import { CALM, type Tension } from '../src/game/tension';

const delay = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** A scene that logs what it is asked to do; its animations take exactly the time asked. */
function fakeScene(reducedMotion = false) {
  const calls: string[] = [];
  const scene: Presenter = {
    reducedMotion,
    cock: (ms) => (calls.push(`cock ${ms}`), delay(ms)),
    release: () => calls.push('release'),
    fire: (spinMs, pace) => calls.push(`fire ${spinMs} ${pace}`),
    flip: (side, ms, turns, slowMs) => (
      calls.push(`flip ${side} ${ms} ${turns}${slowMs ? ` +${slowMs}` : ''}`),
      delay(ms + slowMs)
    ),
    tension: (t) => calls.push(`tension ${t.level}`),
    calm: (ms) => calls.push(`calm ${ms}`),
    win: (level) => calls.push(`win ${level}`),
    lose: () => calls.push('lose'),
    wait: delay,
  };
  return { scene, calls };
}

async function setup(
  options: {
    server?: MockServerOptions;
    speed?: Speed;
    reducedMotion?: boolean;
    /** A run left open at this step, as after a reload. */
    runAt?: number;
  } = {},
) {
  const server = new MockServer({ balance: 100_000, ...options.server });
  if (options.runAt) server.openRunAt(options.runAt, 500);
  const model = new RoundModel(server, await server.init());
  const settings = createSettings();
  settings.set({ ...settings.get(), speed: options.speed ?? 1 });
  const { scene, calls } = fakeScene(options.reducedMotion);
  const played: string[] = [];
  const sounds: RoundSounds = {
    cock: () => played.push('cock'),
    shot: (spinMs) => played.push(`shot ${spinMs}`),
    land: () => played.push('land'),
    win: () => played.push('win'),
    lose: () => played.push('lose'),
    tension: (t) => played.push(`tension ${t.heartbeat?.cue ?? 'none'} ${t.duckDb}`),
    hush: () => played.push('hush'),
    sting: () => played.push('sting'),
    calm: () => played.push('calm'),
  };
  const tension = new Store<Tension>(CALM);
  const stop = startDirector(model, scene, sounds, settings, tension, () => Date.now());
  return {
    server,
    model,
    settings,
    tension,
    calls,
    played,
    stop,
    phase: () => model.state.phase.name,
  };
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

    // a correct pick is a step up the ladder: a short pause
    await advance(1099);
    expect(phase()).toBe('result');
    await advance(1);
    expect(phase()).toBe('idle');
  });

  it('plays each sound as its animation starts', async () => {
    const { server, model, played } = await setup();
    server.forceOutcomes('sheriff');
    await model.pick('outlaw');
    expect(played).toEqual(['cock']);
    await advance(230);
    expect(played).toEqual(['cock', 'shot 900']);
    await advance(1900);
    expect(played).toEqual(['cock', 'shot 900', 'land', 'lose']);
  });

  it('keeps the cylinder quiet when it does not spin', async () => {
    const { model, played } = await setup({ reducedMotion: true });
    await model.pick('sheriff');
    await advance(0);
    expect(played).toContain('shot null');
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
    settings.set({ ...settings.get(), speed: 2 });
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
  it('grows with the run up to the biggest effect', async () => {
    const server = new MockServer();
    const model = new RoundModel(server, await server.init());
    const win = { kind: 'win', amount: 1 } as const;
    expect(celebration(model.state, win, 0)).toEqual({ kind: 'cashout', level: 1 });
    expect(celebration(model.state, win, 7)).toEqual({ kind: 'cashout', level: MAX_WIN_LEVEL });
  });
});

describe('director showdown', () => {
  it('stays calm on the lower rungs', async () => {
    const { server, model, calls, played } = await setup({ runAt: 3 });
    server.forceOutcomes('sheriff');
    await model.pick('sheriff');
    await advance(230);
    expect(calls).toEqual(['cock 230', 'fire 900 1', 'flip sheriff 1900 6']);
    expect(played.some((p) => p.startsWith('tension'))).toBe(false);
  });

  it('turns a flip to the 5th rung of 8 into a duel: darker, ducked, a slow heartbeat, slower', async () => {
    const { server, model, tension, calls, played, phase } = await setup({ runAt: 4 });
    server.forceOutcomes('sheriff');
    await model.pick('sheriff');
    expect(calls).toEqual(['tension 1', 'cock 230']);
    expect(played).toEqual(['tension heartbeat-slow -8', 'cock']);
    expect(tension.get().dimHud).toBe(true);

    await advance(230);
    expect(calls.at(-1)).toBe('flip sheriff 1900 6 +500');
    await advance(2399);
    expect(phase()).toBe('revealing');
    await advance(1);
    expect(phase()).toBe('result');
    // no hush and no sting in a duel
    expect(played).toEqual([
      'tension heartbeat-slow -8',
      'cock',
      'shot 900',
      'land',
      'calm',
      'win',
    ]);
  });

  it('makes the last two rungs a showdown: push-in, a hush before the landing, a sting', async () => {
    const { server, model, calls, played, phase } = await setup({ runAt: 6 });
    server.forceOutcomes('outlaw');
    await model.pick('sheriff');
    expect(calls[0]).toBe('tension 2');
    expect(played[0]).toBe('tension heartbeat-fast -8');
    await advance(230);
    expect(calls.at(-1)).toBe('flip outlaw 1900 6 +900');

    // the hush comes 450 ms before the landing
    await advance(2800 - 451);
    expect(played).not.toContain('hush');
    await advance(1);
    expect(played.at(-1)).toBe('hush');
    await advance(450);
    expect(phase()).toBe('result');
    // the same sting on a loss as on a win: the drama never tells the outcome
    expect(played.slice(-5)).toEqual(['hush', 'land', 'sting', 'calm', 'lose']);
  });

  it('plays the same showdown whatever the outcome', async () => {
    const runs: string[][] = [];
    for (const outcome of ['sheriff', 'outlaw'] as const) {
      const { server, model, calls, played } = await setup({ runAt: 6 });
      server.forceOutcomes(outcome);
      await model.pick('sheriff');
      await advance(230 + 2800);
      runs.push([...calls.slice(0, 3), ...played.slice(0, played.indexOf('land') + 2)]);
    }
    expect(runs[0]).toEqual(runs[1]);
  });

  it('lets go of everything as the coin lands, and stays calm while the player decides', async () => {
    const { server, model, tension, calls, played, phase } = await setup({ runAt: 5 });
    server.forceOutcomes('sheriff');
    await model.pick('sheriff');
    await advance(230 + 2400);
    expect(phase()).toBe('result');
    expect(tension.get()).toEqual({ ...CALM, outMs: 500 });
    expect(calls).toContain('calm 500');
    await advance(1100);
    expect(phase()).toBe('idle');
    // the run now stands on the 6th rung, and the cash out waits: nothing tense
    const after = calls.length;
    await advance(10_000);
    expect(calls.length).toBe(after);
    expect(played.at(-1)).toBe('win');
    expect(tension.get()).toEqual({ ...CALM, outMs: 500 });
  });

  it('lets go of everything on an error', async () => {
    const { server, model, tension, calls, played, phase } = await setup({ runAt: 6 });
    server.failNext('NETWORK');
    await model.pick('sheriff');
    expect(phase()).toBe('error');
    expect(calls).toEqual(['tension 2', 'cock 230', 'release', 'calm 500']);
    expect(played.at(-1)).toBe('calm');
    expect(tension.get()).toEqual({ ...CALM, outMs: 500 });
  });

  it('is calm after a reload into an open run, until the next pick', async () => {
    const { model, tension, calls, played } = await setup({ runAt: 7 });
    await advance(5000);
    expect(model.state.openRun?.step).toBe(7);
    expect(tension.get()).toBe(CALM);
    expect(calls).toEqual([]);
    expect(played).toEqual([]);
  });

  it('keeps a cash out on a high rung plain', async () => {
    const { model, calls, played } = await setup({ runAt: 7 });
    await model.cashOut();
    expect(calls).toEqual(['win 5']);
    expect(played).toEqual(['win']);
  });

  it('lets go when stopped', async () => {
    const { model, tension, calls, stop } = await setup({ runAt: 6 });
    await model.pick('sheriff');
    stop();
    expect(tension.get()).toEqual({ ...CALM, outMs: 500 });
    expect(calls.at(-1)).toBe('calm 500');
  });

  it('keeps only the darkening at 4x', async () => {
    const { server, model, tension, calls, played } = await setup({ runAt: 6, speed: 4 });
    server.forceOutcomes('sheriff');
    await model.pick('sheriff');
    expect(tension.get()).toMatchObject({ level: 2, light: 0.6, dimHud: true, zoom: 1 });
    expect(played[0]).toBe('tension none 0');
    await advance(55);
    expect(calls.at(-1)).toBe('flip sheriff 456 1');
    await advance(456);
    expect(played).not.toContain('sting');
    expect(played).not.toContain('hush');
  });

  it('keeps the darkening and the sound, but no slow motion, with reduced motion', async () => {
    const { server, model, calls, played } = await setup({ runAt: 6, reducedMotion: true });
    server.forceOutcomes('sheriff');
    await model.pick('sheriff');
    await advance(0);
    expect(calls.slice(0, 2)).toEqual(['tension 2', 'cock 0']);
    expect(calls.at(-1)).toBe('flip sheriff 500 1');
    // the hush takes at most half of the short flight
    await advance(249);
    expect(played).not.toContain('hush');
    await advance(1);
    expect(played.at(-1)).toBe('hush');
    await advance(250);
    expect(played).toContain('sting');
  });

  it('still stretches a showdown round to the market minimum', async () => {
    const { model, phase } = await setup({
      runAt: 6,
      server: { jurisdiction: { minRoundMs: 8000 } },
    });
    await model.pick('sheriff');
    await advance(7999);
    expect(phase()).toBe('result');
    await advance(1);
    expect(phase()).toBe('idle');
  });
});
