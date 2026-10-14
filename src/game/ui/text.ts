/**
 * Every string the interface shows, in one place. Step 6 moves them into
 * `locales/*.json`; until then the game is English only.
 */
import type { Side } from '../../server/protocol';
import type { Speed } from '../../shell/settings';

export const text = {
  title: 'High Noon Flip',
  lastFlips: 'Last flips',
  side: { sheriff: 'Sheriff', outlaw: 'Outlaw' } satisfies Record<Side, string>,
  pickKey: {
    sheriff: 'Sheriff: right arrow key',
    outlaw: 'Outlaw: left arrow key',
  } satisfies Record<Side, string>,
  turnCoin: 'Turn the coin over',

  modeGroup: 'Game mode',
  instant: 'Instant',
  multiply: 'Multiply',

  speedName: { 1: 'Normal', 2: 'Fast', 4: 'Turbo' } satisfies Record<Speed, string>,
  speedLabel: (name: string) => `Speed: ${name}. Tap to change.`,

  balance: 'Balance',
  demoBalance: 'Demo balance',
  totalBet: 'Total bet',
  change: 'change',
  changeBet: 'Change bet',
  betDial: 'Bet. Swipe or use the arrow keys to change.',
  chooseBet: 'Choose your bet',
  chooseBetHint: 'Tap a bullet to set your bet',
  close: 'Close',

  ladder: 'Multiplier ladder',
  cashOut: 'Cash out',

  win: 'WIN',
  lose: 'LOSE',

  notEnough: 'Not enough balance for this bet.',
  notEnoughAtAll: 'Not enough balance to play.',
  lowerBet: 'Lower the bet',
  ok: 'OK',
  /** Placeholder until step 6 brings a dialog per error code. */
  error: (code: string) => `Something went wrong (${code}).`,
};
