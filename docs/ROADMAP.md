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

### 3. Pixi scene and the real director

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

### 4. Western interface

Replace the test panel with components under `game/ui/`: balance and bet plaques, bet
dial, Sheriff and Outlaw emblems with keycaps, mode switch, multiply ladder, cash out
tab, result stamp, last-flips strip, insufficient-funds notice. Both orientations.
Open design question: the dial has 6 chambers but operators send 10 to 20 bet levels.

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
- Code, comments and README in English (they ship to the provider); chat in Russian.
  `README.ru.md` is the team's copy; keep both READMEs in step.

## Open questions for the provider

1. Is there a client SDK and a protocol spec?
2. Must the game use the provider's own UI bar?
3. Build requirements: hosting, size budget, supported browsers and devices.
4. Target markets (decides turbo, autoplay, session clock).
5. Languages and currencies, including crypto.
6. Who writes the math and the rules text, and who certifies.
