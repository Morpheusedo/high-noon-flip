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
    /** The side of every bet and pick sent so far. */
    picks: string[];
    /** Every showdown level the interface was dimmed at, in the test that records them. */
    tensions: string[];
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

/** A fresh session; `query` adds launch parameters, such as `&bets=levels`. */
async function openGame(page: Page, query = ''): Promise<void> {
  await page.goto(`./?debug=1${query}`);
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

/** A new round: the side is chosen on its emblem, then BET places the bet. */
async function bet(page: Page, side: 'sheriff' | 'outlaw'): Promise<void> {
  await tap(page.locator(`.pick.${side}`));
  await expect(page.locator(`.pick.${side}`)).toHaveAttribute('aria-pressed', 'true');
  await tap(page.locator('.bet-button'));
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

test('changes the bet on the dial', async ({ page }) => {
  await openGame(page);
  const bet = () => page.evaluate(() => window.hnf?.model?.state.bet);
  const bets = await page.evaluate(() => window.hnf?.model?.state.config.bets ?? []);
  const dial = page.getByRole('slider', { name: /^Bet\./ });
  const value = page.locator('.dial-tab .plaque-value');
  // the demo's lowest bet is 5.00
  await expect(dial).toHaveAttribute('aria-valuetext', '5.00 FUN');
  await expect(page.locator('.dchamber.on')).toHaveText('5');
  // the tab names the amount alone: BET is the button beside it
  await expect(page.locator('.dial-tab')).toHaveText(/^5\.00\s*FUN$/);
  await expect(page.locator('.dial-tab')).toHaveAccessibleName(/^Bet 5\.00 FUN\./);

  // a drag turns the drum one chamber: along it in landscape, up or down in portrait
  const box = await dial.boundingBox();
  const size = page.viewportSize();
  if (!box || !size) throw new Error('no dial');
  const tall = size.height > size.width;
  // the drum's middle is on the stage's edge: press inside its visible half
  const at = tall
    ? { x: box.x + box.width * 0.3, y: box.y + box.height / 2 }
    : { x: box.x + box.width / 2, y: box.y + box.height * 0.3 };
  const chamber = 0.55 * (box.width / 2);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++)
    await page.mouse.move(
      at.x - (tall ? 0 : (chamber * 1.2 * i) / 6),
      at.y + (tall ? (chamber * 1.2 * i) / 6 : 0),
    );
  await page.mouse.up();
  expect(await bet()).toBe(bets[1]);
  await expect(page.locator('.dchamber.on')).toHaveText('7.50');
  await expect(value).toHaveText(/^7\.50\s*FUN$/);

  // the wheel and the arrow keys step it too, and it stops at the lowest bet
  await page.mouse.wheel(0, -60);
  await expect.poll(bet).toBe(bets[0]);
  await page.keyboard.press('ArrowUp');
  expect(await bet()).toBe(bets[1]);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect(await bet()).toBe(bets[0]);
});

test('opens every level from the tab when the server takes levels only', async ({ page }) => {
  await openGame(page, '&bets=levels');
  const bet = () => page.evaluate(() => window.hnf?.model?.state.bet);
  const bets = await page.evaluate(() => window.hnf?.model?.state.config.bets ?? []);
  const value = page.locator('.dial-tab .plaque-value');
  const shown = await value.textContent();
  await tap(page.locator('.dial-tab'));
  // the list, with no field in it and none in the tab
  await expect(page.locator('.picker')).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await tap(page.locator('.picker .bullet').last());
  await expect(page.locator('.picker')).toHaveCount(0);
  expect(await bet()).toBe(bets.at(-1));
  await expect(value).not.toHaveText(shown ?? '');
  await expect(page.getByRole('slider', { name: /^Bet\./ })).toHaveAttribute(
    'aria-valuenow',
    String(bets.length - 1),
  );
});

test('takes a typed bet and plays it', async ({ page }) => {
  await openGame(page);
  const stake = () => page.evaluate(() => window.hnf?.model?.state.bet);
  const edit = page.locator('.dial-edit');
  const note = page.locator('.dial-note');
  // one tap on the bet and the player types: the tab itself is the field, no dialog,
  // with the focus and the bet selected
  await tap(page.locator('.dial-tab'));
  const field = page.getByRole('textbox', { name: 'Your bet in FUN' });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('5.00');
  await expect(page.locator('.picker')).toHaveCount(0);
  await expect(page.locator('.bet-button')).toBeDisabled();
  // the keys type: ↑ does not step the bet, Space does not press BET
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  expect(await stake()).toBe(500);
  expect(await page.evaluate(() => window.hnf?.model?.state.phase.name)).toBe('idle');
  // not an amount: a message beside the field, and it stays open
  await field.fill('abc');
  await field.press('Enter');
  await expect(note).toHaveText('Type an amount, such as 5.00.');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expectApart(page, ['.dial-edit', '.dial-note'], ['.plaque.balance', '.bet-button']);
  // out of range: no message, the nearest stake becomes the bet, the highest or the lowest
  await field.fill('500');
  await field.press('Enter');
  await expect(edit).toHaveCount(0);
  await expect(page.locator('.dial-tab .plaque-value')).toHaveText(/^100\.00\s*FUN$/);
  expect(await stake()).toBe(10_000);
  await tap(page.locator('.dial-tab'));
  await field.fill('3');
  await field.press('Enter');
  await expect(edit).toHaveCount(0);
  await expect(page.locator('.dial-tab .plaque-value')).toHaveText(/^5\.00\s*FUN$/);
  expect(await stake()).toBe(500);
  // off the 0.05 grid: rounded down and shown before it is the bet
  await tap(page.locator('.dial-tab'));
  await field.fill('12.37');
  await expect(note).toBeHidden();
  await field.press('Enter');
  await expect(field).toHaveValue('12.35');
  await expect(note).toContainText('12.35 FUN');
  await tap(page.locator('.dial-ok'));
  await expect(edit).toHaveCount(0);
  await expect(page.locator('.dial-tab .plaque-value')).toHaveText(/^12\.35\s*FUN$/);
  // Escape and a tap elsewhere leave the bet as it was
  await tap(page.locator('.dial-tab'));
  await page.keyboard.type('9');
  await page.keyboard.press('Escape');
  await expect(edit).toHaveCount(0);
  await tap(page.locator('.dial-tab'));
  await page.keyboard.type('9');
  await tap(page.locator('.ladder'));
  await expect(edit).toHaveCount(0);
  expect(await stake()).toBe(1235);
  await expect(page.locator('.bet-button')).toBeEnabled();
  // the drum stops at the typed amount between two levels, and steps to the next level
  await expect(page.locator('.dchamber.on')).toHaveText('12.35');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.dchamber.on')).toHaveText('25');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.dchamber.on')).toHaveText('10');
  await tap(page.locator('.dial-tab'));
  await page.keyboard.type('12.35');
  await page.keyboard.press('Enter');
  await expect(edit).toHaveCount(0);
  await expect(page.locator('.dchamber.on')).toHaveText('12.35');

  const before = await balances(page);
  await page.evaluate(() => window.hnf?.server.forceOutcomes('win'));
  await bet(page, 'sheriff');
  await waitIdle(page);
  const server = await page.evaluate(() => window.hnf?.server.snapshot());
  expect(server?.openRun?.bet).toBe(1235);
  expect(server?.balance).toBe(before.server - 1235);
});

test('names a typed bet too long for its chamber on the tab alone', async ({ page }) => {
  // the test server takes typed stakes up to 10,000,000.00 here
  await openGame(page, '&bets=wide');
  const chosen = page.locator('.dchamber.on');
  const value = page.locator('.dial-tab .plaque-value');
  const type = async (amount: string) => {
    await tap(page.locator('.dial-tab'));
    const field = page.getByRole('textbox', { name: 'Your bet in FUN' });
    await field.fill(amount);
    await field.press('Enter');
    await expect(page.locator('.dial-edit')).toHaveCount(0);
  };
  // a short amount stays on the drum, every digit of it
  await type('12.35');
  await expect(chosen).toHaveText('12.35');
  await expect(chosen.locator('.dmark')).toHaveCount(0);
  // a long one is not squeezed in: a plain mark in its chamber, the amount on the tab
  await type('9999999.99');
  await expect(chosen).toHaveText('');
  await expect(chosen.locator('.dmark')).toBeVisible();
  await expect(value).toHaveText(/^9,999,999\.99\s*FUN$/);
  expect(await value.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expectApart(page, ['.dial-tab'], ['.plaque.balance', '.dchamber.on', '.bet-button']);
  // a screen reader still hears the amount on the dial and on the tab
  await expect(page.getByRole('slider', { name: /^Bet\./ })).toHaveAttribute(
    'aria-valuetext',
    '9,999,999.99 FUN',
  );
  await expect(page.locator('.dial-tab')).toHaveAccessibleName(/^Bet 9,999,999\.99 FUN\./);
  // one turn down is the top level, with its number
  await page.keyboard.press('ArrowDown');
  await expect(chosen).toHaveText('100');
  expect(await page.evaluate(() => window.hnf?.model?.state.bet)).toBe(10_000);
});

test('BET asks for a side first, then keeps it for the next round', async ({ page }) => {
  await openGame(page);
  const before = await balances(page);
  const hint = page.getByRole('status').filter({ hasText: 'Choose Sheriff or Outlaw first' });
  const sheriff = page.locator('.pick.sheriff');
  const outlaw = page.locator('.pick.outlaw');

  // no side yet: BET sends nothing, names the choice and pulses both emblems
  await expect(sheriff).toHaveAttribute('aria-pressed', 'false');
  await tap(page.getByRole('button', { name: 'Bet 5.00 FUN. Choose Sheriff or Outlaw first.' }));
  await expect(hint).toBeVisible();
  await expect(sheriff).toHaveClass(/nudge/);
  await expect(outlaw).toHaveClass(/nudge/);
  expect(await page.evaluate(() => window.hnf?.model?.state.phase.name)).toBe('idle');
  expect(await balances(page)).toEqual(before);
  expect(await page.evaluate(() => window.hnf?.server.snapshot().openRun)).toBeNull();

  // a tap chooses the side and sends nothing either; the other side dims
  await tap(outlaw);
  await expect(hint).toHaveCount(0);
  await tap(sheriff);
  await expect(sheriff).toHaveAttribute('aria-pressed', 'true');
  await expect(sheriff).toHaveClass(/chosen/);
  await expect(outlaw).toHaveAttribute('aria-pressed', 'false');
  await expect(outlaw).toHaveClass(/other/);
  expect(await balances(page)).toEqual(before);

  // Space presses BET on the chosen side
  await page.evaluate(() => {
    window.picks = [];
    window.hnf?.model?.store.subscribe((s) => {
      if (s.phase.name === 'requesting' && s.phase.pick) window.picks.push(s.phase.pick);
    });
    window.hnf?.server.forceOutcomes('lose');
  });
  expect(await playRound(page, () => page.keyboard.press('Space'))).toBe('lose');
  expect(await page.evaluate(() => window.picks)).toEqual(['sheriff']);
  expect((await balances(page)).server).toBe(before.server - 500);

  // the side stays chosen: the next round is one more BET (Enter this time)
  await expect(sheriff).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.hnf?.server.forceOutcomes('lose'));
  expect(await playRound(page, () => page.keyboard.press('Enter'))).toBe('lose');
  expect((await balances(page)).server).toBe(before.server - 1000);
});

test('plays a run and cashes out', async ({ page }) => {
  await openGame(page);
  const shownBefore = await shownBalance(page);
  await page.evaluate(() => window.hnf?.server.forceOutcomes('win', 'win'));

  const cashOut = page.locator('.cashout');
  for (const step of [1, 2]) {
    // the first pick is chosen and placed with BET; in a run one tap flips at once
    if (step === 1) await bet(page, 'outlaw');
    else await tap(page.locator('.pick.outlaw'));
    await waitIdle(page);
    expect(await page.evaluate(() => window.hnf?.model?.state.openRun?.step)).toBe(step);
    // in a run the bet cannot change: the dial is gone and the cash out takes BET's place
    await expect(page.locator('.bet-dial')).toHaveCount(0);
    await expect(page.locator('.bet-button')).toHaveCount(0);
    // the rungs climbed so far light up under the title
    await expect(page.locator('.ladder .rung.on')).toHaveCount(step);
  }
  // the rung, the prize on the table, and the next flip: 5.00 FUN at x3.96, then x7.92
  await expect(cashOut.locator('.cashout-multiplier')).toHaveText('×3.96');
  await expect(cashOut.locator('.cashout-amount')).toHaveText(/^19\.80\s*FUN$/);
  await expect(cashOut.locator('.cashout-next')).toHaveText(
    'Next flip: 50% chance to win 39.60 FUN',
  );

  const before = await balances(page);
  expect(await playRound(page, () => cashOut.click())).toBe('win');

  const after = await balances(page);
  expect(await page.evaluate(() => window.hnf?.model?.state.openRun)).toBeNull();
  expect(after.server).toBeGreaterThan(before.server);
  expect(after.client).toBe(after.server);
  expect(await shownBalance(page)).not.toBe(shownBefore);
  await expect(page.locator('.bet-dial')).toBeVisible();
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

test('plays a showdown on the high rungs, then calms down for the decision', async ({ page }) => {
  await openGame(page);
  const hud = page.locator('.hud');
  // every level the interface was dimmed at, as it happens: at 4x it is over in a moment
  await page.evaluate(() => {
    const el = document.querySelector('.hud');
    if (!(el instanceof HTMLElement)) throw new Error('no interface');
    window.tensions = [];
    new MutationObserver(() => {
      const level = el.dataset.tension;
      if (level) window.tensions.push(level);
    }).observe(el, { attributes: true, attributeFilter: ['data-tension'] });
  });

  // from the 6th rung at 1x (the push-in and the slow motion), from the 7th at 4x
  for (const [runAt, speed, outcome] of [
    [6, 1, 'win'],
    [7, 4, 'lose'],
  ] as const) {
    await page.evaluate(
      async ([runAt, speed, outcome]) => {
        const hnf = window.hnf;
        if (!hnf?.model) throw new Error('the game is not running');
        window.tensions = [];
        hnf.settings.set({ ...hnf.settings.get(), speed });
        hnf.server.openRunAt(runAt, hnf.model.state.bet);
        hnf.server.forceOutcomes(outcome);
        await hnf.model.refresh();
      },
      [runAt, speed, outcome] as const,
    );
    // deciding whether to cash out: nothing dimmed, nothing tense
    await expect(page.locator('.cashout')).toBeEnabled();
    await expect(hud).not.toHaveAttribute('data-tension');

    await tap(page.locator('.pick.sheriff'));
    if (speed === 1) {
      // the controls dim, the ladder under the title does not
      await expect(hud).toHaveAttribute('data-tension', '2');
      await expect
        .poll(() => page.locator('.controls').evaluate((el) => getComputedStyle(el).opacity))
        .toBe('0.6');
      await expect(page.locator('.sign-wrap')).toHaveCSS('opacity', '1');
    }
    await page.waitForFunction(() => window.hnf?.model?.state.phase.name === 'result');
    await waitIdle(page);
    expect(await page.evaluate(() => window.tensions)).toContain('2');

    // the round is over and the screen is calm again
    await expect(hud).not.toHaveAttribute('data-tension');
    await expect
      .poll(() => page.locator('.controls').evaluate((el) => getComputedStyle(el).opacity))
      .toBe('1');
    const run = await page.evaluate(() => window.hnf?.model?.state.openRun ?? null);
    if (outcome === 'win') expect(run?.step).toBe(runAt + 1);
    else expect(run).toBeNull();
  }
  await expect(page.locator('.bet-button')).toBeVisible();
});

test('starts on the rusty coin, unlocks the next by play and shows the way on', async ({
  page,
}) => {
  // the coins' faces the game asks for: the starting coin's only, until another is chosen
  const faces: string[] = [];
  page.on('request', (r) => {
    const face = /coins\/([a-z-]+)-(sheriff|outlaw|icon)\.webp$/.exec(r.url());
    if (face) faces.push(`${face[1]}-${face[2]}`);
  });
  await openGame(page);
  expect(faces.sort()).toEqual(['rusty-outlaw', 'rusty-sheriff']);
  // a first visit has nothing to be reminded of
  await expect(page.locator('.unlock-toast')).toHaveCount(0);

  // 10 flips, all lost: Classic, the Rookie's coin. The first through BET, the rest
  // through the QA hooks, each played to its result by the director
  test.setTimeout(150_000);
  await page.evaluate(() => window.hnf?.server.forceOutcomes(...Array(10).fill('lose')));
  expect(await playRound(page, () => bet(page, 'sheriff'))).toBe('lose');
  await page.evaluate(async () => {
    const model = window.hnf?.model;
    if (!model) throw new Error('the game is not running');
    const idle = () =>
      new Promise<void>((done) => {
        const stop = model.store.subscribe((s) => {
          if (s.phase.name !== 'idle') return;
          stop();
          done();
        });
      });
    for (let i = 1; i < 10; i++) {
      const settled = idle();
      await model.pick('sheriff');
      await settled;
    }
  });
  const toast = page.getByRole('button', { name: 'New coin: Classic — Rookie. Show my coins.' });
  await expect(toast).toBeVisible();
  // after the result, clear of BET; measured and tapped at once, as it stays 4.5 s
  const clear = await page.evaluate(() => {
    const note = document.querySelector('.unlock-toast')?.getBoundingClientRect();
    const button = document.querySelector('.bet-button')?.getBoundingClientRect();
    return !!note && !!button && note.bottom < button.top;
  });
  expect(clear).toBe(true);

  // the note opens the settings at the coins, the worn one focused, the next one under them
  await toast.click();
  const coins = page.getByRole('dialog', { name: 'Settings' });
  await expect(coins.getByRole('button', { name: 'Rusty' })).toBeFocused();
  await expect(
    coins.getByRole('button', { name: /^Silver — Old hand, locked: Reach rung 3 in 3 runs/ }),
  ).toHaveAttribute('aria-disabled', 'true');
  await expect(coins.locator('.coin-next')).toHaveText('Next: Silver, rung 3 in 0 of 3 runs');
  await expect(page.locator('.unlock-toast')).toHaveCount(0);

  const classic = coins.getByRole('button', { name: 'Classic — Rookie' });
  await classic.click();
  await expect(classic).toHaveAttribute('aria-pressed', 'true');
  // its faces load only now, and the choice is kept
  await expect
    .poll(() => faces.filter((f) => f.startsWith('classic-') && f !== 'classic-icon').sort())
    .toEqual(['classic-outlaw', 'classic-sheriff']);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('hnf.coins') ?? '{}').chosen),
  ).toBe('classic');
  await coins.getByRole('button', { name: 'Close' }).click();
  await expect(coins).toHaveCount(0);

  // one run to rung 3, cashed out: a step towards Silver, and a bet of 25.00 on the dial
  await page.evaluate(() => {
    const hnf = window.hnf;
    if (hnf?.model) {
      hnf.model.setBet(2500);
      hnf.server.openRunAt(2, 2500);
    }
    hnf?.server.forceOutcomes('win');
    return hnf?.model?.refresh();
  });
  await playRound(page, () => tap(page.locator('.pick.sheriff')));
  await playRound(page, () => page.locator('.cashout').click());

  // back next time: the same coin and bet, and a short note on the next coin
  await page.reload();
  const next = page.getByRole('button', {
    name: 'Next: Silver, rung 3 in 1 of 3 runs. Show my coins.',
  });
  await expect(next).toBeVisible({ timeout: 30_000 });
  await waitIdle(page);
  expect(await page.evaluate(() => window.hnf?.model?.state.bet)).toBe(2500);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('hnf.coins') ?? '{}').chosen),
  ).toBe('classic');
  // it fades by itself
  await expect(next).toHaveCount(0, { timeout: 8_000 });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('BET with no side lights the emblems up and holds still', async ({ page }) => {
    await openGame(page);
    await tap(page.locator('.bet-button'));
    await expect(page.getByText('Choose Sheriff or Outlaw first')).toBeVisible();
    // both outlines fully lit, and nothing pulses or hops
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.querySelectorAll('.pick')].map((pick) => ({
            halo: getComputedStyle(pick, '::before').opacity,
            moving: pick.getAnimations({ subtree: true }).length,
          })),
        ),
      )
      .toEqual([
        { halo: '1', moving: 0 },
        { halo: '1', moving: 0 },
      ]);
  });

  test('shows a new prize at once and sends no coins', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => {
      const hnf = window.hnf;
      if (hnf?.model) hnf.server.openRunAt(1, hnf.model.state.bet);
      hnf?.server.forceOutcomes('win');
      return hnf?.model?.refresh();
    });
    const prize = page.locator('.cashout-amount');
    await expect(prize).toHaveText(/^9\.90\s*FUN$/);
    await tap(page.locator('.pick.sheriff'));
    // the moment the coin lands the prize is the new one, with no count in between
    await page.waitForFunction(() => window.hnf?.model?.state.openRun?.step === 2);
    await expect(prize).toHaveText(/^19\.80\s*FUN$/, { timeout: 50 });
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

  await bet(page, 'sheriff');
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
  expect(await playRound(page, () => bet(page, 'sheriff'))).toBe('lose');

  // the hint for BET with no side fits between the emblems and the bet
  await page.reload();
  await expect(page.locator('#loader')).toHaveCount(0, { timeout: 30_000 });
  await tap(page.locator('.bet-button'));
  const hint = await page.locator('.side-hint span').boundingBox();
  expect(hint).not.toBeNull();
  for (const selector of ['.plaque.balance', '.dial-tab', '.dchamber.on', '.bet-button']) {
    const box = await page.locator(selector).boundingBox();
    if (!hint || !box) continue;
    const apart =
      box.x >= hint.x + hint.width ||
      box.x + box.width <= hint.x ||
      box.y >= hint.y + hint.height ||
      box.y + box.height <= hint.y;
    expect(apart, `the hint runs into ${selector}`).toBe(true);
  }
});

test('fits the ladder between the corner buttons on a small phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'portrait', 'a portrait layout');
  const ladder = page.getByRole('list', { name: 'Multiplier ladder' });
  const runAt = (step: number) =>
    page.evaluate(async (s) => {
      const hnf = window.hnf;
      if (!hnf?.model) return;
      hnf.server.openRunAt(s, hnf.model.state.bet);
      await hnf.model.refresh();
    }, step);

  // an iPhone SE (1st gen): the gaps give way, and all eight rungs still show
  await page.setViewportSize({ width: 320, height: 568 });
  await openGame(page);
  await expectControlsOnScreen(page);
  await expect(ladder.locator('.rung.out')).toHaveCount(0);
  for (const step of [1, 4, 7]) {
    await runAt(step);
    await expect(ladder.locator('.rung.on')).toHaveCount(step);
    await expectApart(page, ['.ladder'], BESIDE_LADDER);
  }
  await info.attach('320 x 568', { body: await page.screenshot(), contentType: 'image/png' });

  // narrower still (a small iframe): a window of rungs with the top one after an
  // ellipsis; a screen reader still gets all eight
  await page.setViewportSize({ width: 280, height: 500 });
  await runAt(1);
  await expect(ladder.locator('.rung.out')).not.toHaveCount(0);
  await expect(ladder.getByRole('listitem')).toHaveCount(8);
  for (const shown of ['.rung.on', '.rung.next', '.rung-gap', '.rung:last-child'])
    await expect(ladder.locator(shown), shown).toBeInViewport();
  await expectApart(page, ['.ladder'], BESIDE_LADDER);
  await info.attach('280 x 500', { body: await page.screenshot(), contentType: 'image/png' });
});

/** Each of `these` stands clear of each of `those`. */
async function expectApart(page: Page, these: string[], those: string[]): Promise<void> {
  for (const a of these)
    for (const b of those) {
      const one = await page.locator(a).boundingBox();
      const two = await page.locator(b).boundingBox();
      if (!one || !two) continue;
      const apart =
        one.x >= two.x + two.width ||
        one.x + one.width <= two.x ||
        one.y >= two.y + two.height ||
        one.y + one.height <= two.y;
      expect(apart, `${a} runs into ${b}`).toBe(true);
    }
}

const CONTROLS = [
  '.pick.sheriff',
  '.pick.outlaw',
  '.plaque.balance',
  '.dial-tab',
  // the drum sinks into the edge by design; its chosen bullet must be in view
  '.dchamber.on',
  '.bet-button',
  '.tool.rules',
  '.tool.settings',
  '.ladder',
];

/** The controls at the bottom, which must stand apart. */
const BOTTOM = ['.plaque.balance', '.dial-tab', '.dchamber.on', '.bet-button'];

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
  for (const [i, a] of BOTTOM.entries())
    for (const b of BOTTOM.slice(i + 1)) {
      const one = await page.locator(a).boundingBox();
      const two = await page.locator(b).boundingBox();
      if (!one || !two) continue;
      const apart =
        one.x >= two.x + two.width ||
        one.x + one.width <= two.x ||
        one.y >= two.y + two.height ||
        one.y + one.height <= two.y;
      expect(apart, `${a} runs into ${b}`).toBe(true);
    }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow, 'horizontal scroll').toBe(false);
}
