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

### 5. Sound

`shell/audio/`: one audio manager, an audio sprite instead of 20 files, music that
blends calm and intense by stake, sound and music volumes, mute.

### 6. Shell screens and texts

Loader with progress; error dialogs per error code; rules screen built from the config
(RTP, payouts, ladder, max win, game version); settings; all strings in `locales/en.json`
and `locales/ru.json`.

### 7. QA panel

`debug/`: shown with `?debug=1` in demo mode only. Force outcomes, force errors,
set balance, latency, reset the session, jump to a rung.

### 8. Preview build

Version and build hash on the rules screen, a Playwright smoke test, a check on a
low-end phone, a static preview link to send to the provider.

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
- Win effect size: the bet's position among the operator's levels mapped to 0..5; a cash
  out by the run length.
- The bet dial is an endless drum: one chamber (60°) is one level, each chamber shows the
  level nearest to it and is relabelled only on the far side, out of view. It stops at
  the lowest and highest bet, never wraps. Flicks coast at most two levels; longer jumps
  (Home, End, the bet list) snap. The bet plaque opens every level as a grid.
- Interface images live in `src/game/ui/art/` so Vite hashes them and CSS paths follow
  the CDN base; `public/assets/` keeps only what Pixi loads at run time.
- All interface strings are in `game/ui/text.ts`, ready to move to `locales/` in step 6.
- A server INSUFFICIENT_FUNDS resyncs the balance: it means the balance changed outside
  the game. "Lower the bet" picks the highest bet the refreshed balance covers.
- Arrow keys ignore auto-repeat: a held key must not become autoplay.
- Errors other than insufficient funds show a plain notice with the code until step 6.
- Code, comments and README in English (they ship to the provider); chat in Russian.
  `README.ru.md` is the team's copy; keep both READMEs in step.

## Open questions for the provider

1. Is there a client SDK and a protocol spec?
2. Must the game use the provider's own UI bar?
3. Build requirements: hosting, size budget, supported browsers and devices.
4. Target markets (decides turbo, autoplay, session clock).
5. Languages and currencies, including crypto.
6. Who writes the math and the rules text, and who certifies.
