/** What the browser tests share: the QA handles' types and a hermetic page. */
import type { Page } from '@playwright/test';
import type { RoundModel } from '../src/game/model/RoundModel';
import type { QaServer } from '../src/server/qa';
import type { Settings } from '../src/shell/settings';
import type { Store } from '../src/shell/store';

declare global {
  interface Window {
    /** The QA console handles that `debug=1` sets; `model` arrives once the game has loaded. */
    hnf?: { server: QaServer; settings: Store<Settings>; model?: RoundModel };
  }
}

/**
 * Google Fonts are outside the build: a test must not depend on them, and the game
 * must start in its fallback fonts anyway.
 */
export async function stubFonts(page: Page): Promise<void> {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  );
}
