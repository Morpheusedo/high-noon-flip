# High Noon Flip

[Русская версия](README.ru.md)

A western coin flip: choose Sheriff or Outlaw and press BET, the revolver fires and flips
the coin.
Each correct pick doubles the prize, from 1.98x up to 253.44x; cash out at any time, and
one wrong pick loses the stake.

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
`?lang=de&mode=demo&debug=1&lobbyUrl=https://casino.example`. For QA, `debug=1&bets=levels`
starts the test server without typed stakes, so the bet's tab opens the list of levels, and
`debug=1&bets=wide` takes typed stakes up to 10,000,000.00 FUN (in steps of 0.01, with a
balance of 20,000,000.00 in a session of its own), for amounts too long for a chamber.

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
'after')`), `hnf.model`, `hnf.scene` (`hnf.scene.win(5)`), `hnf.settings`, `hnf.audio`
and `hnf.collection` (the coin collection).
`hnf` exists before the game loads, so a failure can be armed for `init` from the console.

### Builds and the preview

The rules screen names the build: "Game version 0.1.0, build a1b2c3d". The version
comes from `package.json`, the build from git (`scripts/buildInfo.ts`): the short
commit, "-dirty" with uncommitted changes, `GIT_COMMIT` when a CI builds without git,
"unknown" otherwise.

`npm run smoke` serves `dist/` with `vite preview` and plays it in Playwright on a
360 x 640 phone, portrait and landscape: loading, the bet dial (a drag, the wheel, the arrow
keys), the bet list where the server takes levels only, a bet typed in the tab (a message, an amount out of range clamped,
rounding, Escape and a tap outside) shown on the drum and played to the server, a typed bet too long for its chamber (a mark on the drum, every digit on the tab), BET with no side (a hint and nothing sent; still outlines with reduced
motion), a side chosen and kept for the next BET with Space and Enter, a run with its next prize, its rungs lit and its cash out (coins to the balance; none
with reduced motion), the last flips in the settings, a lost answer (NETWORK) and its recovery, a run resumed after a reload
and cashed out with Space, the controls on screen (the ladder clear of the corners, the balance, the dial and BET
apart) before and after a rotation, and in portrait on an iPhone SE (320 x 568) the ladder
fitted between the corner buttons through a run, then at 280 x 500 a window of rungs with the
top one after an ellipsis, and a showdown from the 6th rung at 1x and the 7th at 4x (the
controls dimmed but for the ladder, then calm again and back to idle), and the coin
collection (a first visit wears the rusty coin and fetches only its faces; 10 flips unlock
Classic: "New coin: Classic — Rookie" clear of BET, its note opening the coins with the next
one under them, Classic chosen and only then its faces fetched; after a reload the same coin
and bet, and a short note on the next coin that fades by itself). Outcomes are forced through `hnf`, so
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
│  ├─ bets.ts         which stakes the server takes: levels and typed amounts
│  ├─ mockServer.ts   in-browser stand-in for the RGS, with QA controls
│  └─ qa.ts           what the QA panel may ask of a test server
├─ shell/             parts every game needs; will move to a shared package
│  ├─ launchParams.ts reading and validating the launch URL
│  ├─ money.ts        minor units ↔ "€198.00" for any currency and language
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
   ├─ collection/     the coin collection: skins, unlock rules counted from results, storage
   ├─ lastBet.ts      the last bet, kept between visits; the config decides whether it holds
   ├─ director.ts     turns phase changes into animations, reports back when done
   ├─ timing.ts       every duration of a round, scaled by speed in one place
   ├─ tension.ts      the showdown on the high rungs: its levels by rung, cues and times
   ├─ sound.ts        this game's sounds and how the music follows the stake
   ├─ rules.ts        the figures the rules screen shows, taken from the server config
   ├─ scene/          PixiJS: everything drawn on the canvas
   │  ├─ GameScene.ts     the canvas, the layers, the API the director calls
   │  ├─ Background.ts    photo, sun shade, dust, parallax, vignette
   │  ├─ Revolver.ts      hammer, cylinder spin, recoil, smoke
   │  ├─ Coin.ts          flip to an outcome, idle tease, turn by hand, glow, shadow
   │  ├─ coinArt.ts       a skin's faces, loaded when needed; the classic coin if its art is missing
   │  ├─ Effects.ts       muzzle flash, sparks, win rays and coins, loss dim, shake
   │  ├─ Showdown.ts      the showdown's spotlight and the camera's push-in on the coin
   │  ├─ layout.ts        reads and checks scene-layout.json
   │  └─ tween.ts         tweens and waits on the scene clock
   └─ ui/             Preact: the HTML interface over the canvas
      ├─ App.tsx          lays out the controls, keyboard shortcuts
      ├─ TopBar.tsx       title with the ladder under it, speed
      ├─ Emblems.tsx      Sheriff and Outlaw (choose a side; flip in a run), keycaps, hint, coin tap
      ├─ BetDial.tsx      the bet: the revolver's cylinder in the right edge
      ├─ BetTab.tsx       the tab over the chosen chamber: the amount, and the field it turns into
      ├─ typedBet.ts      what a typed amount means: the stake, a rounding, or why not
      ├─ dial.ts          the dial's arithmetic: six chambers over any number of levels and a typed bet
      ├─ Plaques.tsx      balance, BET, ladder, cash out (multiplier, prize, next flip)
      ├─ ladderFit.ts     how the ladder fits its width: gaps, then rungs, then a window of rungs
      ├─ Payout.tsx       coins flying from the cash out to the balance
      ├─ BetPicker.tsx    every bet level at once, when the server takes levels only
      ├─ Settings.tsx     mute, the settings button and panel (volumes, speed, last flips, coins)
      ├─ Coins.tsx        the coins in the settings with the next one, and the notes: a coin
      │                   unlocked, or how near the next one is when a player comes back
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
   ├─ images/coins/   coin skins in the order of the path: coins.json (faces, icon, rim, unlock
   │                  rule; the starting and the fallback skin) and their art
   └─ audio/          built by `npm run audio`: sfx.m4a sprite, music loops, audio.json
assets-src/audio/     the sound sources the audio build reads; not shipped
assets-src/coins/     coin art kept out of the game: Lucky, a promotional coin for later
scripts/              the audio sprite, the build hash, the size report, the preview deploy,
                      placeholder coin skins (`coin-placeholders.sh`, ImageMagick)
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
  `scene-layout.json` next to it, not in code.
- **Bets come from the operator.** The cylinder dial turns through whatever levels the
  config sends; the client never assumes a number of them. The tab over the chosen chamber
  names the amount and, with levels only, opens the list of them all. When the config has
  `customBet` (the server takes any stake in a range, on a grid), one tap turns the tab itself
  into a field, in place, with the bet selected: the player types at once, a phone raises its
  keyboard from that tap, and the field lifts itself over the keyboard. The amount is read as
  the player's language writes numbers, and one out of range becomes the lowest or the
  highest stake; the drum stops at a typed amount between two levels
  and turns from it to the next one. A typed amount too long for its chamber (measured, in
  any currency) shows a pencil mark there, and the tab names every digit. `server/bets.ts` holds the rule, and the client and the
  mock server both use it. The last bet is kept between visits (`game/lastBet.ts`); one the
  config no longer takes (another currency, a changed list, outside the typed range) gives way
  to the default bet, and an open run's own bet wins over it.
- **A round starts in two steps.** A tap on an emblem (or ← →) chooses the side, BET places
  the bet on it, and the side stays chosen for the next round. The choice lives in the
  interface, not in the model: the server hears of it only with the bet. In a run a tap on a
  side flips at once.
- **The showdown follows the rung, never the outcome.** A flip to the last four rungs of the
  ladder is a duel, to the last two a showdown (`game/tension.ts`): the light closes in on the
  coin, the music ducks, a heartbeat, slow motion at the end of the flight, on the last two a
  push-in and a sting. It runs from the tap to the landing only, and the same whatever the
  server decided: while the player decides whether to cash out, the screen is calm.
- **Coins are earned by play, never by money.** The collection is a path from a rusty coin to
  gold: a new player wears the rusty one, and each next coin unlocks from round results (flips,
  rungs reached, a cash out's rung), never from the stake, and changes only how the coin looks.
  Skins and their rules live in `images/coins/coins.json`, in the path's order; a new skin is
  its art and a line there. The manifest keeps two roles apart: `start` is the coin a new
  player wears, `classic` the fallback whose faces stand in for missing art (part of the
  game's required art, though players earn it). Progress sits behind `CollectionStore`
  (localStorage today); the coins show the next one and how far the player is. Only the chosen
  skin's faces load with the game; missing art for a skin shows the classic coin and a console
  warning, not a loading error.
- **Keys:** ← Outlaw, → Sheriff, ↑ ↓ bet, Space or Enter BET (cash out in a run). A held key
  does not repeat, so it cannot act as autoplay. A button reached with Tab keeps its own
  Space and Enter. While the player types a bet, the keys are the field's and BET waits.
- **No string in code.** Every text the player reads is a key in `src/locales/en.json`.
  English is bundled; any other language is a small chunk loaded only when `lang` asks for
  it. To add a language, add `xx.json` next to `en.json`; a test fails until it has every
  key with the same `{placeholders}`. A missing language or key falls back to English.
- **The rules come from the config.** Payouts, the ladder, bets, RTP and the maximum win
  on the rules screen are read from the server's `GameConfig`, never typed into the text.

## Stack

TypeScript (strict), Vite, PixiJS 8, Preact, Vitest, Playwright, ESLint, Prettier.
Versions are pinned exactly in `package.json`.
