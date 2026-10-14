# High Noon Flip

[Русская версия](README.ru.md)

A western coin flip: pick Sheriff or Outlaw, the revolver fires and flips the coin.
Two modes: **Instant** (one flip, pays 1.98x) and **Multiply** (each correct pick doubles
the prize up to 253.44x; cash out at any time).

`prototype/` holds the original single-file prototype. It is the reference for how the
game should look, sound and feel; it is not part of the build.

## Commands

| Command                  | What it does                                     |
| ------------------------ | ------------------------------------------------ |
| `npm install`            | Install dependencies                             |
| `npm run dev`            | Dev server at http://localhost:5173              |
| `npm test`               | Unit tests (Vitest)                              |
| `npm run typecheck`      | TypeScript check                                 |
| `npm run lint`           | ESLint                                           |
| `npm run format`         | Prettier                                         |
| `npm run build`          | Type check, then a static build in `dist/`       |
| `npm run smoke`          | Build, then the browser smoke test               |
| `npm run lowend`         | Build, then measure it on a simulated slow phone |
| `npm run size`           | Size of `dist/` by kind, as served               |
| `npm run preview:deploy` | Checks, smoke, then a preview on Netlify         |
| `npm run audio`          | Rebuild the sound sprite and music (macOS)       |

The browser tests need Playwright's Chromium once: `npx playwright install chromium`.

Launch parameters go in the URL, as an operator would pass them:
`?lang=de&mode=demo&debug=1&lobbyUrl=https://casino.example`.

### QA panel

With `debug=1` in demo mode (never with `mode=real`) a **QA** tab sits at the left edge of
the page; it or the `` ` `` key opens the panel. It changes the test server, never the
client, so whatever the screen shows still comes from a server answer:

- **Next flips:** queue Sheriff, Outlaw, or a win or loss against whatever the player picks.
- **Errors:** any server error code, either before the server (the request changes nothing)
  or after it (the server settles the round, the answer is lost: the round recovery case).
  Offline makes every request fail; latency from 0 to 5 s.
- **Balance:** set the server balance. "Update the screen now" resyncs the client; without
  it the next bet finds out, as when the balance changes in another tab.
- **Multiply run:** open a run at any rung with the current bet, or move an open run.
- **Session:** reset to a first visit (settings stay), or reload mid-round.

The panel is a separate chunk that only `debug=1` downloads. The console has the same
objects: `hnf.server` (`hnf.server.forceOutcomes('win')`, `hnf.server.failNext('NETWORK',
'after')`), `hnf.model`, `hnf.scene` (`hnf.scene.win(5)`), `hnf.settings` and `hnf.audio`.
`hnf` exists before the game loads, so a failure can be armed for `init` from the console.

### Builds and the preview

The rules screen names the build: "Game version 0.1.0, build a1b2c3d". The version
comes from `package.json`, the build from git (`scripts/buildInfo.ts`): the short
commit, "-dirty" with uncommitted changes, `GIT_COMMIT` when a CI builds without git,
"unknown" otherwise.

`npm run smoke` serves `dist/` with `vite preview` and plays it in Playwright on a
360 x 640 phone, portrait and landscape: loading, an Instant bet, a Multiply run and its
cash out, a lost answer (NETWORK) and its recovery, a run resumed after a reload, the
controls on screen before and after a rotation. Outcomes are forced through `hnf`, so
every run is the same; any console error or failed request fails it.

`npm run lowend` measures load time, bytes, frame rate and memory with the CPU and
network slowed down; `docs/LOW_END_CHECK.md` has its budgets, the results and the
checklist for a real phone. `docs/PREVIEW.md` covers the provider's preview link.

## How the client is built

```
src/
├─ main.ts            boot: launch params → text, server, art behind the loader → game
├─ locales/           every string the player reads: en.json (the base), ru.json
├─ server/
│  ├─ protocol.ts     the contract with the game server (RGS); start here
│  ├─ mockServer.ts   in-browser stand-in for the RGS, with QA controls
│  └─ qa.ts           what the QA panel may ask of a test server
├─ shell/             parts every game needs; will move to a shared package
│  ├─ launchParams.ts reading and validating the launch URL
│  ├─ money.ts        minor units → "€198.00" for any currency and language
│  ├─ assets.ts       asset URLs that work under any CDN path
│  ├─ i18n.ts         dictionaries: placeholders, plurals, language fallback
│  ├─ loader.ts       the loading screen's progress and its error state
│  ├─ errors.ts       a screen and a way out for each server error code
│  ├─ storage.ts      localStorage that survives being blocked or full
│  ├─ settings.ts     the player's settings (speed, sound), saved; the turbo rule
│  ├─ audio/          AudioManager: one context, sprite, music layers, volumes, mute
│  └─ store.ts        observable state; useStore.ts connects it to Preact
├─ debug/             the QA panel, loaded only with debug=1 in demo mode
└─ game/
   ├─ model/          RoundModel: the round state machine, the source of truth
   ├─ director.ts     turns phase changes into animations, reports back when done
   ├─ timing.ts       every duration of a round, scaled by speed in one place
   ├─ sound.ts        this game's sounds and how the music follows the stake
   ├─ rules.ts        the figures the rules screen shows, taken from the server config
   ├─ scene/          PixiJS: everything drawn on the canvas
   │  ├─ GameScene.ts     the canvas, the layers, the API the director calls
   │  ├─ Background.ts    photo, sun shade, dust, parallax, vignette
   │  ├─ Revolver.ts      hammer, cylinder spin, recoil, smoke
   │  ├─ Coin.ts          flip to an outcome, idle tease, turn by hand, glow, shadow
   │  ├─ Effects.ts       muzzle flash, sparks, win rays and coins, loss dim, shake
   │  ├─ layout.ts        reads and checks scene-layout.json
   │  └─ tween.ts         tweens and waits on the scene clock
   └─ ui/             Preact: the HTML interface over the canvas
      ├─ App.tsx          lays out the controls, keyboard shortcuts
      ├─ TopBar.tsx       title, last flips, Instant / Multiply, speed
      ├─ Emblems.tsx      Sheriff and Outlaw picks, keycaps, the tap over the coin
      ├─ Plaques.tsx      balance, total bet, multiply ladder, cash out
      ├─ BetDial.tsx      the cylinder bet dial; its arithmetic is in dial.ts
      ├─ BetPicker.tsx    every bet level at once, from the bet plaque
      ├─ Settings.tsx     mute, the settings button and panel (volumes, speed)
      ├─ Rules.tsx        the info button and the rules screen
      ├─ Notices.tsx      result stamp, insufficient funds, error dialogs
      ├─ Dialog.tsx       the frame every dialog uses
      ├─ text.ts          useText(): the player's dictionary for components
      ├─ art.ts           the list of interface images, for the loader to fetch first
      └─ art/             interface images, bundled and hashed by Vite
tests/                unit tests for the model, the director, the server mock and the shell
   └─ node/           tests of the build scripts, which run in Node
e2e/                  Playwright: the smoke test and the slow-phone measurement
docs/
   ├─ ROADMAP.md      the plan, what is done, and the decisions taken
   ├─ LOW_END_CHECK.md  slow-phone budgets, results, and the real-device checklist
   └─ PREVIEW.md      the preview link for the provider
public/assets/        scene images and sounds, loaded at run time
   ├─ images/scene-layout.json  positions on the stage and measurements on the art
   └─ audio/          built by `npm run audio`: sfx.m4a sprite, music loops, audio.json
assets-src/audio/     the sound sources the audio build reads; not shipped
scripts/              the audio sprite, the build hash, the size report, the preview deploy
index.html            the loading screen, styled inline so it shows before any script
playwright.config.ts  browser test projects: portrait, landscape, low-end
netlify.toml          headers of the preview site
tsconfig.node.json    types for the code that runs in Node (configs, scripts, e2e)
```

Rules the code follows:

- **The server decides.** The client sends a request and shows the answer. It never picks
  an outcome and never computes a balance; the balance always comes from the response.
- **One seam to the outside world.** Everything goes through the `GameServer` interface.
  Today `MockServer` implements it; a provider adapter will implement it on top of the
  provider's SDK, and nothing else changes.
- **Money is integer minor units** (cents) everywhere. Only `shell/money.ts` turns an amount
  into text.
- **Game state lives in the model, not in the DOM.** The scene and the interface display
  state; they do not own it.
- **The round waits for the animations.** The director awaits the scene, whose clock pauses
  with the tab, and enforces the market's shortest round time on top.
- **Art comes with its measurements.** Positions measured on an image live in
  `scene-layout.json` (scene) or `ui/art/cylinder.json` (bet dial) next to it, not in code.
- **Bets come from the operator.** The dial is an endless drum over any number of levels;
  the client never assumes six.
- **Keys:** ← Outlaw, → Sheriff, ↑ ↓ bet. A held key does not repeat, so it cannot act as
  autoplay.
- **No string in code.** Every text the player reads is a key in `src/locales/en.json`.
  English is bundled; any other language is a small chunk loaded only when `lang` asks for
  it. To add a language, add `xx.json` next to `en.json`; a test fails until it has every
  key with the same `{placeholders}`. A missing language or key falls back to English.
- **The rules come from the config.** Payouts, the ladder, bets, RTP and the maximum win
  on the rules screen are read from the server's `GameConfig`, never typed into the text.

## Stack

TypeScript (strict), Vite, PixiJS 8, Preact, Vitest, Playwright, ESLint, Prettier.
Versions are pinned exactly in `package.json`.
