/**
 * Smoke test of the built game. Each test opens a fresh session with `debug=1`
 * and fixes the server's answers through `hnf.server` (the QA handles), so the
 * outcomes are the same on every run. The client is never touched: the screen
 * must follow the server, as in production.
 *
 * Any console error, uncaught exception or failed request fails the test.
 */
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { stubFonts } from './game';

declare global {
  interface Window {
    /** Every result stamp shown so far, as "win" or "lose": at 4x one is gone in a moment. */
    stamps: string[];
    /** Coins that flew from the cash out to the balance so far. */
    coins: number;
  }
}

const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console: ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push(`exception: ${e.message}`));
      page.on('requestfailed', (r) =>
        problems.push(`request failed: ${r.url()} ${r.failure()?.errorText ?? ''}`),
      );
      page.on('response', (r) => {
        if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
      });
      await stubFonts(page);
      await page.addInitScript(() => {
        // fastest speed and no sound; the market in the mock allows turbo
        localStorage.setItem('hnf.settings', JSON.stringify({ speed: 4, muted: true }));
        window.stamps = [];
        window.coins = 0;
        new MutationObserver((changes) => {
          for (const change of changes)
            for (const node of change.addedNodes) {
              if (!(node instanceof HTMLElement)) continue;
              if (node.classList.contains('stamp'))
                window.stamps.push(node.classList.contains('lose') ? 'lose' : 'win');
              window.coins += node.querySelectorAll('.payout-coin').length;
            }
        }).observe(document, { childList: true, subtree: true });
      });
      await use(problems);
      expect(problems, 'errors in the console or the network').toEqual([]);
    },
    { auto: true },
  ],
});

async function openGame(page: Page): Promise<void> {
  await page.goto('./?debug=1');
  await expect(page.locator('#loader')).toHaveCount(0, { timeout: 30_000 });
  await page.waitForFunction(() => window.hnf?.model !== undefined);
  await waitIdle(page);
}

function waitIdle(page: Page) {
  return page.waitForFunction(() => window.hnf?.model?.state.phase.name === 'idle');
}

/**
 * Taps the middle of a control, as a finger would. The picks hop without end, so
 * Playwright's own click, which waits for the element to stand still, would wait
 * forever. The cash out stands still between picks, so it takes a normal click.
 */
async function tap(control: Locator): Promise<void> {
  await expect(control).toBeEnabled();
  const box = await control.boundingBox();
  if (!box) throw new Error(`${control.toString()} has no box`);
  await control.page().touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/** Runs `action` and returns the result stamp the round ends with. */
async function playRound(page: Page, action: () => Promise<void>): Promise<string> {
  const seen = await page.evaluate(() => window.stamps.length);
  await action();
  await expect.poll(() => page.evaluate(() => window.stamps.length)).toBeGreaterThan(seen);
  await waitIdle(page);
  return page.evaluate((i) => window.stamps[i] ?? '', seen);
}

/** The balance the client shows and the one the server holds. */
function balances(page: Page) {
  return page.evaluate(() => {
    const hnf = window.hnf;
    if (!hnf?.model) throw new Error('the game is not running');
    return { client: hnf.model.state.balance, server: hnf.server.snapshot().balance };
  });
}

/** The balance plaque once its count-up has settled. */
async function shownBalance(page: Page): Promise<string> {
  const plaque = page.locator('.plaque.balance .plaque-value');
  let last = '';
  await expect
    .poll(async () => {
      const now = (await plaque.textContent()) ?? '';
      const settled = now === last;
      last = now;
      return settled;
    })
    .toBe(true);
  return last;
}

test('loads and names its version and build', async ({ page }) => {
  await openGame(page);
  await tap(page.locator('.tool.rules'));
  await expect(
    page.getByText(/Game version \d+\.\d+\.\d+, build ([0-9a-f]{7}(-dirty)?|unknown)/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.rules-panel')).toHaveCount(0);
});

test('changes the bet with − and +, and from the list', async ({ page }) => {
  await openGame(page);
  const bet = () => page.evaluate(() => window.hnf?.model?.state.bet);
  const bets = await page.evaluate(() => window.hnf?.model?.state.config.bets ?? []);
  const value = page.locator('.stake-value .plaque-value');
  await expect(page.getByRole('button', { name: 'Lower the bet' })).toBeDisabled();

  await tap(page.getByRole('button', { name: 'Raise the bet' }));
  expect(await bet()).toBe(bets[1]);
  await tap(page.getByRole('button', { name: 'Lower the bet' }));
  expect(await bet()).toBe(bets[0]);

  const shown = await value.textContent();
  await tap(page.locator('.stake-value'));
  await tap(page.locator('.picker .bullet').last());
  await expect(page.locator('.picker')).toHaveCount(0);
  expect(await bet()).toBe(bets.at(-1));
  await expect(value).not.toHaveText(shown ?? '');
  await expect(page.getByRole('button', { name: 'Raise the bet' })).toBeDisabled();
});

test('takes a typed bet and plays it', async ({ page }) => {
  await openGame(page);
  // one tap on the bet and the player types: the field has the focus, the bet selected
  await tap(page.locator('.stake-value'));
  const field = page.getByRole('textbox', { name: 'Your bet in FUN' });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('1.00');
  // off the 0.05 grid: rounded down and shown before it is the bet
  await page.keyboard.type('7.37');
  await expect(field).toHaveValue('7.37');
  await field.press('Enter');
  await expect(field).toHaveValue('7.35');
  await expect(page.locator('.picker-note')).toContainText('7.35 FUN');
  await tap(page.locator('.picker-ok'));
  await expect(page.locator('.picker')).toHaveCount(0);
  await expect(page.locator('.stake-value .plaque-value')).toHaveText(/^7\.35\s*FUN$/);

  const before = await balances(page);
  await page.evaluate(() => window.hnf?.server.forceOutcomes('win'));
  await tap(page.locator('.pick.sheriff'));
  await waitIdle(page);
  const server = await page.evaluate(() => window.hnf?.server.snapshot());
  expect(server?.openRun?.bet).toBe(735);
  expect(server?.balance).toBe(before.server - 735);
});

test('plays a run and cashes out', async ({ page }) => {
  await openGame(page);
  const shownBefore = await shownBalance(page);
  await page.evaluate(() => window.hnf?.server.forceOutcomes('win', 'win'));

  const cashOut = page.locator('.cashout');
  for (const step of [1, 2]) {
    await tap(page.locator('.pick.outlaw'));
    await waitIdle(page);
    expect(await page.evaluate(() => window.hnf?.model?.state.openRun?.step)).toBe(step);
    // in a run the cash out takes the bet's place
    await expect(page.locator('.stake')).toHaveCount(0);
    // the rungs climbed so far light up under the title
    await expect(page.locator('.ladder .rung.on')).toHaveCount(step);
  }
  // the rung, the prize on the table, and the next flip: 1.00 FUN at x3.96, then x7.92
  await expect(cashOut.locator('.cashout-multiplier')).toHaveText('×3.96');
  await expect(cashOut.locator('.cashout-amount')).toHaveText(/^3\.96\s*FUN$/);
  await expect(cashOut.locator('.cashout-next')).toHaveText(
    'Next flip: 50% chance to win 7.92 FUN',
  );

  const before = await balances(page);
  expect(await playRound(page, () => cashOut.click())).toBe('win');

  const after = await balances(page);
  expect(await page.evaluate(() => window.hnf?.model?.state.openRun)).toBeNull();
  expect(after.server).toBeGreaterThan(before.server);
  expect(after.client).toBe(after.server);
  expect(await shownBalance(page)).not.toBe(shownBefore);
  await expect(page.locator('.stake')).toBeVisible();
  // the money flew to the balance, and the coins are gone
  expect(await page.evaluate(() => window.coins)).toBeGreaterThanOrEqual(5);
  await expect(page.locator('.payout-coin')).toHaveCount(0);

  // the last flips are in the settings, newest first, by side name
  await tap(page.locator('.tool.settings'));
  const flips = page.getByRole('list', { name: 'Last flips, newest first' });
  await expect(flips.getByRole('listitem')).toHaveCount(2);
  await expect(flips.getByRole('listitem', { name: 'Outlaw' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Close' }).click();
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows a new prize at once and sends no coins', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => {
      const hnf = window.hnf;
      if (hnf?.model) hnf.server.openRunAt(1, hnf.model.state.bet);
      hnf?.server.forceOutcomes('win');
      return hnf?.model?.refresh();
    });
    const prize = page.locator('.cashout-amount');
    await expect(prize).toHaveText(/^1\.98\s*FUN$/);
    await tap(page.locator('.pick.sheriff'));
    // the moment the coin lands the prize is the new one, with no count in between
    await page.waitForFunction(() => window.hnf?.model?.state.openRun?.step === 2);
    await expect(prize).toHaveText(/^3\.96\s*FUN$/, { timeout: 50 });
    await waitIdle(page);

    expect(await playRound(page, () => page.locator('.cashout').click())).toBe('win');
    expect(await page.evaluate(() => window.coins)).toBe(0);
  });
});

test('recovers a round whose answer was lost (NETWORK)', async ({ page }) => {
  await openGame(page);
  const before = await balances(page);
  // the server settles the bet, then the answer never arrives
  await page.evaluate(() => window.hnf?.server.failNext('NETWORK', 'after'));

  await tap(page.locator('.pick.sheriff'));
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('NETWORK');
  await dialog.getByRole('button', { name: 'Try again' }).click();
  await expect(dialog).toHaveCount(0);
  await waitIdle(page);

  const after = await balances(page);
  expect(after.server).not.toBe(before.server);
  expect(after.client).toBe(after.server);
});

test('resumes an open run after a reload', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    const hnf = window.hnf;
    if (hnf?.model) hnf.server.openRunAt(3, hnf.model.state.bet);
  });
  await page.reload();
  await expect(page.locator('#loader')).toHaveCount(0, { timeout: 30_000 });

  await expect(page.locator('.cashout')).toBeEnabled();
  expect(await page.evaluate(() => window.hnf?.model?.state.openRun?.step)).toBe(3);

  // a keyboard player cashes out with Space
  expect(await playRound(page, () => page.keyboard.press('Space'))).toBe('win');
  expect(await page.evaluate(() => window.hnf?.model?.state.openRun)).toBeNull();
});

test('fits the screen and survives a rotation', async ({ page }, info) => {
  await openGame(page);
  await expectControlsOnScreen(page);
  await info.attach('start', { body: await page.screenshot(), contentType: 'image/png' });

  const size = page.viewportSize();
  if (!size) throw new Error('no viewport');
  await page.setViewportSize({ width: size.height, height: size.width });
  await expectControlsOnScreen(page);
  await info.attach('rotated', { body: await page.screenshot(), contentType: 'image/png' });

  // still plays after the scene was rebuilt
  await page.evaluate(() => window.hnf?.server.forceOutcomes('lose'));
  expect(await playRound(page, () => tap(page.locator('.pick.sheriff')))).toBe('lose');
});

const CONTROLS = [
  '.pick.sheriff',
  '.pick.outlaw',
  '.plaque.balance',
  '.stake',
  '.tool.rules',
  '.tool.settings',
  '.ladder',
];

/** What the ladder under the title must not run into. */
const BESIDE_LADDER = [
  '.plaque.balance',
  '.tool.speed',
  '.tool.sound',
  '.tool.settings',
  '.tool.rules',
];

async function expectControlsOnScreen(page: Page): Promise<void> {
  const size = page.viewportSize();
  if (!size) throw new Error('no viewport');
  for (const selector of CONTROLS) {
    const control = page.locator(selector);
    await expect(control, selector).toBeVisible();
    const box = await control.boundingBox();
    expect(box, selector).not.toBeNull();
    if (!box) continue;
    expect(box.x, `${selector} left`).toBeGreaterThanOrEqual(0);
    expect(box.y, `${selector} top`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${selector} right`).toBeLessThanOrEqual(size.width + 0.5);
    expect(box.y + box.height, `${selector} bottom`).toBeLessThanOrEqual(size.height + 0.5);
  }
  const ladder = await page.locator('.ladder').boundingBox();
  for (const selector of BESIDE_LADDER) {
    const box = await page.locator(selector).boundingBox();
    if (!ladder || !box) continue;
    const apart =
      box.x >= ladder.x + ladder.width ||
      box.x + box.width <= ladder.x ||
      box.y >= ladder.y + ladder.height ||
      box.y + box.height <= ladder.y;
    expect(apart, `the ladder runs into ${selector}`).toBe(true);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow, 'horizontal scroll').toBe(false);
}
