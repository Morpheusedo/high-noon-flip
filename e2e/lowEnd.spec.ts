/**
 * The build on a slow phone, simulated: Chrome's CPU throttling and a slow mobile
 * network through the DevTools protocol, a Moto G4 screen at its real density.
 * Run with `npm run lowend` after `npm run build`. It prints a report and attaches
 * it as JSON; it fails only past the budgets below.
 *
 * A simulation, not a phone: a desktop GPU stays a desktop GPU, so the frame rate
 * here is an upper bound. The real-device checklist is docs/LOW_END_CHECK.md.
 */
import { test, expect, type CDPSession, type Page } from '@playwright/test';
import { stubFonts } from './game';

/** Lighthouse's mobile profile: 4x slower CPU, 150 ms round trip, 1.6 Mbit/s down. */
const CPU_SLOWDOWN = Number(process.env.CPU_SLOWDOWN ?? 4);
const NETWORK = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};

/** Fails the run past these. Generous on purpose: they catch regressions, not polish. */
const BUDGET = {
  /** From navigation to the game taking input. */
  loadMs: 12_000,
  /** Bytes over the network until then (compressed as sent). */
  firstLoadBytes: 4 * 1024 * 1024,
  /** JS heap growth over the rounds played, after garbage collection. */
  heapGrowthBytes: 5 * 1024 * 1024,
};

const ROUNDS = 20;

test('runs on a slow phone', async ({ page }, info) => {
  test.setTimeout(180_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  await cdp.send('Performance.enable');

  // Playwright sees the requests of Pixi's loading worker too; the page's CDP session does not
  const files: { url: string; bytes: number }[] = [];
  page.on('requestfinished', (request) => {
    void request
      .sizes()
      .then((size) =>
        files.push({ url: request.url(), bytes: size.responseBodySize + size.responseHeadersSize }),
      );
  });
  await stubFonts(page);
  // the player's defaults: normal speed; muted only so the run is quiet
  await page.addInitScript(() =>
    localStorage.setItem('hnf.settings', JSON.stringify({ speed: 1, muted: true })),
  );

  const started = Date.now();
  await page.goto('./?debug=1');
  await expect(page.locator('#loader')).toHaveCount(0, { timeout: 60_000 });
  await page.waitForFunction(() => window.hnf?.model?.state.phase.name === 'idle');
  const loadMs = Date.now() - started;
  const firstLoad = [...files];
  const firstLoadBytes = firstLoad.reduce((sum, f) => sum + f.bytes, 0);

  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });

  const idle = await frames(page, () => page.waitForTimeout(3000));
  const round = await frames(page, async () => {
    await page.evaluate(() => window.hnf?.server.forceOutcomes('win'));
    // choose the side, then BET
    await page.locator('.pick.sheriff').dispatchEvent('click');
    await page.locator('.bet-button').dispatchEvent('click');
    await page.waitForFunction(() => window.hnf?.model?.state.phase.name !== 'idle');
    await page.waitForFunction(() => window.hnf?.model?.state.phase.name === 'idle', null, {
      timeout: 30_000,
    });
  });

  // a showdown from the 6th rung at normal speed: the push-in, the darkening, the slow
  // motion; then the run is cashed out, so the rounds below start as before
  const showdown = await frames(page, async () => {
    await page.evaluate(async () => {
      const hnf = window.hnf;
      if (!hnf?.model) throw new Error('the game is not running');
      hnf.server.openRunAt(6, hnf.model.state.bet);
      hnf.server.forceOutcomes('win');
      await hnf.model.refresh();
    });
    await page.locator('.pick.sheriff').dispatchEvent('click');
    await page.waitForFunction(() => window.hnf?.model?.state.phase.name !== 'idle');
    await page.waitForFunction(() => window.hnf?.model?.state.phase.name === 'idle', null, {
      timeout: 30_000,
    });
  });
  await page.evaluate(() => window.hnf?.model?.cashOut());
  await page.waitForFunction(() => window.hnf?.model?.state.openRun === null);
  await page.waitForFunction(() => window.hnf?.model?.state.phase.name === 'idle');

  // many rounds at 4x, then compare the heap: a leak grows with every round
  const heapBefore = await heap(cdp);
  await page.evaluate(async (rounds) => {
    const hnf = window.hnf;
    const model = hnf?.model;
    if (!hnf || !model) throw new Error('the game is not running');
    hnf.settings.set({ ...hnf.settings.get(), speed: 4 });
    const idle = () =>
      new Promise<void>((resolve) => {
        const stop = model.store.subscribe((s) => {
          if (s.phase.name === 'idle') {
            stop();
            resolve();
          }
        });
      });
    for (let i = 0; i < rounds; i++) {
      hnf.server.forceOutcomes(i % 2 ? 'win' : 'lose');
      const done = idle();
      await model.pick(i % 2 ? 'sheriff' : 'outlaw');
      await done;
    }
  }, ROUNDS);
  const heapAfter = await heap(cdp);

  const report = {
    device: `Moto G4 (${page.viewportSize()?.width}x${page.viewportSize()?.height})`,
    cpuSlowdown: `${CPU_SLOWDOWN}x`,
    network: '150 ms RTT, 1.6 Mbit/s down',
    renderer,
    loadMs,
    firstLoadKB: Math.round(firstLoadBytes / 1024),
    firstLoadFiles: firstLoad.length,
    // audio must not be among them: it starts after the game is up
    firstLoadAudio: firstLoad.filter((f) => /\.(m4a|ogg|webm|mp3)$/.test(f.url)).length,
    idle,
    round,
    showdown,
    heapMB: { before: mb(heapBefore), after: mb(heapAfter), rounds: ROUNDS },
  };
  console.log(JSON.stringify(report, null, 2));
  await info.attach('low-end report', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });

  expect.soft(loadMs, 'load time').toBeLessThan(BUDGET.loadMs);
  expect.soft(firstLoadBytes, 'first load bytes').toBeLessThan(BUDGET.firstLoadBytes);
  expect.soft(report.firstLoadAudio, 'audio before the game is up').toBe(0);
  expect.soft(heapAfter - heapBefore, 'heap growth').toBeLessThan(BUDGET.heapGrowthBytes);
});

/** Frame rate while `during` runs: the average, and frames that took over 50 ms. */
async function frames(page: Page, during: () => Promise<unknown>) {
  await page.evaluate(() => {
    const w = window as unknown as { frameTimes: number[]; counting: boolean };
    w.frameTimes = [];
    w.counting = true;
    let last = performance.now();
    const tick = (now: number) => {
      w.frameTimes.push(now - last);
      last = now;
      if (w.counting) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await during();
  const times = await page.evaluate(() => {
    const w = window as unknown as { frameTimes: number[]; counting: boolean };
    w.counting = false;
    return w.frameTimes.slice(1);
  });
  const total = times.reduce((sum, t) => sum + t, 0);
  return {
    fps: total ? Math.round((times.length / total) * 1000) : 0,
    longFrames: times.filter((t) => t > 50).length,
    worstMs: Math.round(Math.max(0, ...times)),
  };
}

async function heap(cdp: CDPSession): Promise<number> {
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
}

function mb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}
