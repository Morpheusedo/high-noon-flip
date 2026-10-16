# Roadmap: High Noon Flip production client

Goal: rebuild the prototype (`prototype/index.html`) as a production-grade client that a
provider can review, then integrate with its SDK. The prototype stays the reference for
look, sound and feel; match it unless a step below says otherwise.

Work is split into steps, one chat per step. A new chat reads this file, `README.md` and
the code of the steps it builds on, does its step, ticks it here, and commits.

## Steps

### 1. Scaffold and server contract — done

Vite + TS + Pixi 8 + Preact, lint, format, tests. `GameServer` contract, `MockServer`
with recovery and QA controls, money formatting, launch params.

### 2. Round state machine — done

`game/model/RoundModel.ts`: phases `idle → requesting → revealing → result → idle`, plus
`error`. Locks controls by phase, resumes an open run, resyncs after unclear errors.
`game/director.ts` is a timer placeholder; `game/ui/App.tsx` is a plain test panel.

### 3. Pixi scene and the real director — done

Port from the prototype into classes under `game/scene/`:

- `Background`: landscape and portrait art, slight blur, sun dimming, dust motes, parallax.
- `Revolver`: base, hammer, cocked frame, cylinder spin strip, recoil, smoke.
- `Coin`: two faces, flip to a given outcome, idle tease, turn over on tap, shadow, glint.
- `Effects`: muzzle flash, sparks, win coins and rays, loss dim, screen shake.

Then replace the timer director: on `revealing`, cock, fire and fly the coin to
`phase.flip.outcome`, then `finishReveal()`; on `result`, play win or loss, then
`finishResult()`. Speed (1x/2x/4x) scales timings in one place; respect
`jurisdiction.minRoundMs` and `turboAllowed`; respect `prefers-reduced-motion`.
Positions measured on the art go in a layout config next to the art, not in code.

### 4. Western interface — done

Replace the test panel with components under `game/ui/`: balance and bet plaques, bet
dial, Sheriff and Outlaw emblems with keycaps, mode switch, multiply ladder, cash out
tab, result stamp, last-flips strip, insufficient-funds notice, speed button (hidden
where turbo is banned), a tap target over the coin that calls `scene.turnCoin()`. Both
orientations.

### 5. Sound — done

`shell/audio/`: one audio manager, an audio sprite instead of 20 files, music that
blends calm and intense by stake, sound and music volumes, mute.

### 6. Shell screens and texts — done

Loader with progress; error dialogs per error code; rules screen built from the config
(RTP, payouts, ladder, max win, game version); settings; all strings in `locales/en.json`
and `locales/ru.json`.

### 7. QA panel — done

`debug/`: shown with `?debug=1` in demo mode only. Force outcomes, force errors,
set balance, latency, reset the session, jump to a rung.

### 8. Preview build — done

Version and build hash on the rules screen, a Playwright smoke test (`npm run smoke`),
a check on a simulated slow phone (`npm run lowend`, `docs/LOW_END_CHECK.md`) with a
checklist for a real one, and a Netlify preview link (`npm run preview:deploy`,
`docs/PREVIEW.md`).

### 9. Multiply only, the bet in the middle — done

Instant is gone from the server contract, the model, the interface, the rules and the
texts. The cylinder dial and the "Total bet" plaque are replaced by one bet block in the
middle at the bottom (− amount +), with the cash out in its place during a run.

## Decisions

- Server decides; the client never picks outcomes or computes balances.
- All server access goes through `GameServer`; `MockServer` until the provider SDK is known.
- Money is integer minor units; only `shell/money.ts` formats it.
- State lives in `RoundModel` and reaches the screen through `Store`; views never write it.
- One reactivity mechanism: `shell/store.ts` + `useStore` (no signals library).
- TypeScript 6.0, not 7: typescript-eslint does not support 7 yet.
- The scene runs in design units (1600 x 900, 900 x 1600) and rebuilds on rotation; the
  face of the coin survives the rebuild. Art measurements live in
  `public/assets/images/scene-layout.json`, checked on load.
- Own tweens on the Pixi ticker, not GSAP: the director awaits them, and they pause with
  the tab. A newer tween of a field takes over; sequences use delays, not promise chains.
- No drawn fallbacks for missing art: missing art is a loading error.
- The blurred background is baked into a texture once per resize, not blurred each frame.
  Ask the artist for a pre-blurred photo later.
- Parallax moves the photo within its 3% overscan; only with a hovering pointer, never
  with reduced motion.
- Speed is a player setting (`shell/settings.ts`), read once per round. Pace factors 1,
  0.5, 0.24 as in the prototype; `turboAllowed: false` forces 1x.
- `minRoundMs` counts from the bet request; a shortfall extends the result pause, the
  animations are never slowed.
- Win effect size: a cash out by the run length, 1 to 5.
- Multiply only (step 9): one mode is one thing to learn, and the ladder is the game.
  `PlayRequest` has no `mode`; `GameConfig` has no `instantMultiplier`. If a provider's
  RGS keeps modes, the adapter sends `multiply`.
- The bet is one block in the middle at the bottom (step 9): "− BET 1.00 FUN +". − and +
  step one level and close at the ends; the amount opens every level as a grid. In a run
  the cash out takes its place, since the bet cannot change then. The cylinder dial in
  the corner did not read as a bet control to players, so it is gone.
- Interface images live in `src/game/ui/art/` so Vite hashes them and CSS paths follow
  the CDN base; `public/assets/` keeps only what Pixi loads at run time.
- Strings live in `src/locales/*.json`, flat keys (`"rules.bets"`), `{name}` placeholders,
  plurals as CLDR forms picked by `count`. The key type comes from `en.json`, so a typo is a
  type error. No HTML in dictionaries: bold words are placeholders the view fills.
- English is bundled (the base and the loading error's text); other languages are lazy
  chunks. `lang=pt-BR` tries `pt-BR`, `pt`, any `pt-*`, then English. Numbers and money
  follow the requested `lang` even when its text falls back to English.
- A server INSUFFICIENT_FUNDS resyncs the balance: it means the balance changed outside
  the game. "Lower the bet" picks the highest bet the refreshed balance covers.
- Arrow keys ignore auto-repeat: a held key must not become autoplay.
- One dialog per server error code (`shell/errors.ts`), with the code shown for support.
  NETWORK offers "Try again", the others "Continue"; both resync through `dismissError`.
  SESSION_EXPIRED is fatal: "Back to the lobby" (top window, falling back to the game's
  frame) when the operator gave `lobbyUrl`, and "Reload". Escape never closes an error.
  Unknown codes read as a general error. Insufficient funds keeps its own notice.
- The loading screen is inline in `index.html`. Progress weights: text 1, init 2, scene art
  8, interface art 4, fonts 1 (fonts give up after 3 s). Sound is not counted. A failed
  load shows the reason and "Reload".
- The rules show exact multipliers (×15.84, not the ladder's ×15.8): a regulator checks them
  against the math. Max win is the top multiplier of any mode times the highest bet, rounded
  down as the server pays. "Malfunction voids all pays and plays" is always shown.
- `__APP_VERSION__` comes from `package.json` and `__BUILD_HASH__` from git, both through
  Vite `define`. The hash is `GIT_COMMIT` if a CI sets it, else the short commit of this
  project's own repository (not a parent one), "-dirty" with uncommitted changes, else
  "unknown". The rules show both: "Game version 0.1.0, build a1b2c3d".
- Sound: `shell/audio/AudioManager` is shared (one context, unlock on the first touch,
  silent while the tab is hidden, effects and music buses); `game/sound.ts` is this
  game's sound design. Sound starts loading once the game is up and never holds it: on a
  slow network its 1.2 MB took bandwidth from the art (ready in 11.9 s instead of 9.4 s).
- The 20 recorded effects are one sprite, built by `npm run audio` from
  `assets-src/audio/`; the build decodes the result and fails if any clip moved by more
  than 6 ms. Music stays two loop files: long loops do not belong in a sprite.
- AAC (.m4a) only for now: macOS afconvert cannot write Ogg or WebM Opus, and the
  installed ffmpeg is broken. `audio.json` lists files per format, so Opus can be added
  later without code changes. AAC plays in Chrome, Safari, Firefox and Edge on Windows,
  macOS, Android and iOS.
- Shot, ring, landing, win and clicks are still the prototype's synthesized placeholders;
  a recording added to the sprite under the same cue replaces one. Ask the provider's
  sound designer for them.
- Defaults: effects 15, music 6, not muted, 1x. Settings are saved in `localStorage`
  (`hnf.settings`) and checked field by field on load. Raising the music slider unmutes.
- The music button became a settings button (gear): volumes, and speed where turbo is
  allowed. The mute and speed buttons stay for one-tap access. The info button hangs under
  the speed button, or takes its place where turbo is banned.
- In portrait the mode switch scales with the stage (no 13 px floor), so it no longer
  runs under the music button on narrow phones, as it did in the prototype.
- The QA panel changes the test server, never the client: it talks to `QaServer`
  (`server/qa.ts`), which `MockServer` implements and a provider's staging cheat API can
  implement later. Where the client would not notice by itself, the panel calls
  `RoundModel.refresh()`, the same resync an operator's "balance updated" message will use.
- Forced flips can be a side or a win/loss against the player's pick. A forced error fails
  either before the server (nothing changes) or after it settles (the answer is lost): the
  second one is the round recovery case.
- The panel is a lazy chunk mounted in its own root beside the stage, so it never moves the
  game's layout and a player's session never downloads it. Keys pressed inside it do not reach
  the game. It opens with the ` key, matched by position (`ё` on a Russian layout).
- The panel's labels are English in code, not in `locales/`: it is a tool for QA, not text a
  player reads, and it must not add keys every language has to translate.
- `hnf` (console handles) is set before loading, so QA can arm a failure for `init`.
- Interface art (CSS images) is fetched behind the loader (`game/ui/art.ts`, a Vite glob of
  `ui/art/*.webp`), so the interface never fills in after the loading screen. A missing
  interface image is a loading error, as missing scene art is.
- Smoke test: Playwright 1.64.0 (pinned, a week old when taken), on `vite preview` of
  `dist/`, a Moto G4 (360 x 640) in portrait and landscape. Device scale 1: headless WebGL
  is software, and 3x only slows it, the CSS layout is the same. Taps, not clicks: the
  picks hop and the cash out tab pulses, so Playwright's "wait until still" never ends.
  Result stamps are recorded by a MutationObserver: at 4x one is gone before a poll.
  Google Fonts are stubbed: the test must not depend on a third party.
- Code that runs in Node (configs, scripts, e2e, `tests/node`) is checked with
  `tsconfig.node.json`, so Node types never leak into the game's code.
- The slow-phone check runs in installed Google Chrome, which draws with the GPU;
  Playwright's headless shell draws WebGL in software at ~5 fps, which says nothing.
  Profile: CPU 4x, Lighthouse mobile network. It cannot slow the GPU: a real phone is still
  needed before a build goes to the provider (`docs/LOW_END_CHECK.md`).
- Preview on Netlify: each build a draft at its own address named by version and commit,
  deployed from a local build that passed the smoke test (Netlify never builds). The
  deploy refuses uncommitted changes. Free plan: the link is unlisted and `noindex`, not
  password-protected. `netlify-cli` runs through `npx` at a pinned version instead of
  joining the dependencies.
- Code, comments and README in English (they ship to the provider); chat in Russian.
  `README.ru.md` is the team's copy; keep both READMEs in step.

## Open questions for the provider

1. Is there a client SDK and a protocol spec?
2. Must the game use the provider's own UI bar?
3. Build requirements: hosting, size budget, supported browsers and devices. Our defaults
   until then are in `docs/LOW_END_CHECK.md`.
4. Target markets (decides turbo, autoplay, session clock).
5. Languages and currencies, including crypto.
6. Who writes the math and the rules text, and who certifies. The rules text and its
   Russian translation are ours for now and need the provider's compliance review.
7. Fonts come from Google Fonts. EU operators may reject requests to Google from inside
   the game (GDPR); self-host them before a real-money launch.
