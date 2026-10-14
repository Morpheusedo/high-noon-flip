/**
 * Browser tests of the built game in dist/, served by `vite preview`:
 *
 * - `portrait`, `landscape`: the smoke test on a small phone (`npm run smoke`).
 * - `low-end`: the build on a simulated slow phone (`npm run lowend`).
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Headless Chromium draws WebGL in software (SwiftShader), a few frames a second
  // on a phone-sized canvas: rounds take seconds, so tests get a minute.
  timeout: 60_000,
  // A Moto G4 (360 x 640) is the smallest screen the layout must hold. Its 3x pixel
  // density only makes software WebGL slower; the layout is the same in CSS pixels.
  // Speed on a phone is checked separately: docs/LOW_END_CHECK.md.
  projects: [
    {
      name: 'portrait',
      testMatch: 'smoke.spec.ts',
      use: { ...devices['Moto G4'], deviceScaleFactor: 1 },
    },
    {
      name: 'landscape',
      testMatch: 'smoke.spec.ts',
      use: { ...devices['Moto G4 landscape'], deviceScaleFactor: 1 },
    },
    // Installed Google Chrome, not Playwright's headless shell: Chrome draws with the
    // GPU, the shell in software, whose frame rate says nothing about a phone.
    // LOW_END_BROWSER=bundled runs it where Chrome is not installed (a CI box).
    {
      name: 'low-end',
      testMatch: 'lowEnd.spec.ts',
      use: {
        ...devices['Moto G4'],
        ...(process.env.LOW_END_BROWSER === 'bundled' ? {} : { channel: 'chrome' }),
      },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !ci,
  },
});
