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

### 10. Typed bets — done

With `customBet` in the config the bet list has a field for an exact amount (7.35 FUN),
checked against the range, the grid and the balance before it becomes the bet. Without
it nothing changes. The rules name the range and the step, and the maximum win follows
the highest typed stake.

### 11. A livelier cash out — done

The cash out plaque names the next prize ("Next win 7.92 FUN", or that the top rung pays out
by itself), counts the prize up and pops once on each correct pick instead of bobbing
forever, gives under a press, rises in place of the bet when a run starts, and sends coins
to the balance on a cash out. Space cashes out, with a keycap beside the plaque.

### 12. A plainer cash out — done

The plaque reads at a glance: CASH OUT large in the title's western letters, the rung's
multiplier larger still, the prize under them, and along the bottom the next flip's chance
and what it pays ("Next flip: 50% chance to win 7.92 FUN"). The chance comes from the
server's config.

### 13. Type the bet at once — done

With `customBet` on, one tap on the bet amount opens the list with the field focused and
the bet selected, so the player types over it, and a phone raises its keyboard from that
same tap. Enter or OK sets the bet as in step 10; with the keyboard up, a tap outside the
field puts the keyboard away and shows the bullets. Without `customBet` nothing changes.

### 14. Emblems lower, the balance up top — done

In landscape the Outlaw and Sheriff emblems stand lower and closer to the revolver, beside
the ladder, with their arrow keycaps under them, and the balance plaque moves to the top
left corner. Portrait is unchanged. Picked from three variants compared side by side.

### 15. The ladder under the title, the last flips in the settings — done

The row of last flips under the title sign is gone; the settings panel lists them instead
("Last flips", newest first, the same Sheriff and Outlaw icons, a note before the first
flip). The multiplier ladder takes the row's place under the title in both orientations,
so it no longer sits over the scene above the bet (landscape) or down the left side
(portrait).

### 16. Choose a side, then BET — done

A tap on the Sheriff or Outlaw emblem (or ← →) only chooses the side: the chosen one
stands raised and lit, the other dims. A large gold BET button beside the bet places the
bet on it, and the side stays chosen for the next round. BET with no side sends nothing,
says "Choose Sheriff or Outlaw first" and pulses both emblems once. In a run a tap on a
side still flips at once. Space and Enter press BET, or cash out in a run.

### 17. The cylinder dial is back — done

The revolver's cylinder is the bet again, in place of − amount +: half sunk into the
bottom edge right of BET in landscape, into the right edge in portrait. A BET tab over the
chosen chamber names the amount and opens the bet list with its field (steps 10 and 13).
BET stands alone in the middle at the bottom, where the cash out stands in a run. The drum
stops at a typed amount between two levels, and the dial is gone during a run.

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
- The bet is one block in the middle at the bottom (step 9; replaced by the dial in step 17):
  "− BET 1.00 FUN +". − and +
  step one level and close at the ends; the amount opens every level as a grid. In a run
  the cash out takes its place, since the bet cannot change then. The cylinder dial in
  the corner did not read as a bet control to players, so it is gone.
- Typed bets (step 10) are switched on by the server, not the client: `GameConfig.customBet`
  `{ min, max, step }` in minor units, absent or null for levels only. `server/bets.ts`
  `isValidBet` is the one rule: a level, or `min..max` with `(bet - min) % step === 0`.
  `RoundModel.setBet` and `MockServer` both use it, so the client never offers a stake the
  server refuses. The demo takes 0.10 to 100.00 FUN in steps of 0.05.
- The field lives in the bet list, above the bullets: one place to change the bet. It
  reads the number in the player's language (`parseAmount` in `shell/money.ts`): the
  language's decimal mark, its grouping, and a lone other mark as a decimal one when it
  cannot be grouping ("7,35" in English), since a phone keyboard offers the device's mark,
  not the game's. More decimals than the currency has is not an amount (JPY "1.5").
- Below the minimum, above the maximum or above the balance: a message with the limit as
  an amount, and the dialog stays. Off the step: rounded down to the grid, shown in the
  field with a note, and OK once more makes it the bet. A stake is never changed silently.
- − and + (and ↑ ↓) still step through the levels; from a typed amount between two levels
  they go to the next one up or down. The dial (step 17) and ↑ ↓ keep this rule. "Lower the bet" after insufficient funds offers the
  highest level the balance covers, and the balance on the grid only below every level:
  never an odd all-in amount while a level fits.
- With a phone keyboard up the bet list pads itself into the visible part of the stage
  (`visualViewport`) and shows only the title and the field. It follows the viewport, not
  the focus: a tap on OK blurs the field, and a layout that moved on blur would move OK from
  under the finger. Checked with a simulated viewport; a real phone keyboard is still on the
  device checklist.
- One tap on the bet puts the player in the field (step 13): the field opens focused with
  the bet selected, so typing replaces it; the bullets stay below it. Without `customBet`
  the tap focuses the current bullet, as before.
- iOS Safari raises the keyboard only for a `focus()` run inside the tap's own handler, and
  the field mounts with the list, after the handler has returned. So the tap focuses a
  stand-in field kept in the interface (`.focus-stand-in`, unseen, `inputmode="decimal"`
  like the real one, 16px so iOS does not zoom), and the real field takes the focus over in
  a layout effect on mount; a phone keeps its keyboard when focus moves from one text field
  to another. Chosen over keeping the list mounted and hidden: a hidden dialog would sit in
  the accessibility tree and keep its viewport listeners for the whole session. Checked in
  Chrome, where both focuses land inside the click's dispatch; a real iPhone is still on the
  device checklist.
- The selection is made with `setSelectionRange`, not `select()`, which iOS ignores on a
  field focused by script.
- With a phone keyboard up, a tap outside the field puts the keyboard away instead of closing
  the list, so the bullets come back one tap after the field; a second tap outside closes it.
  Whether the keyboard was up is read on `pointerdown`: Chrome and Android blur the field on
  the press, before the click arrives.
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
  is software, and 3x only slows it, the CSS layout is the same. Taps, not clicks, on the
  picks: they hop, so Playwright's "wait until still" never ends. The cash out stands still
  between picks (step 11) and takes a normal click.
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
- The cash out shows the next prize (step 11): take it or risk it is the player's real
  decision, and the ladder alone made them work it out. Until the server sends it, the client
  computes it as `payout(bet, ladder[step])` (`rules.ts` `nextPrize`), the floor the rules
  screen uses; on the top-but-one rung it says the next win pays out by itself.
- The cash out stands still between picks (step 11). The endless bob and the gold line traced
  with an animated `clip-path` are gone: `clip-path` is repainted every frame on low-end
  Android for as long as a run is open. Instead a correct pick counts the prize up from the
  old one in 400 ms and pops the plaque once (scale 1.04, 240 ms, through `animate()` so it
  replays per rung). A press scales it to 0.97. A new run lifts it in with `@starting-style`
  (opacity, 30% lower, scale 0.96; 220 ms). Reduced motion: no pop, no rise, the number
  changes at once.
- A payout (a cash out or the top rung) sends 7 coins on an arc from the plaque to the
  balance in 550 ms, and the balance count waits for them to land. HTML over the canvas,
  `translate`, `transform` and `opacity` only, `pointer-events: none`, removed when done; the
  plaque's place is measured on each rung and on the press, since the plaque is gone when
  the answer arrives. None with reduced motion. The coins are drawn in CSS: there is no coin
  art small enough for the interface; ask the artist for one.
- The cash out plaque (step 12) is a grid: CASH OUT (Rye, gold) over the amount on the left,
  the multiplier (Alfa Slab One, the largest text on the plaque) on the right, and the next
  flip's line across the bottom. The multiplier is what the player compares with the ladder;
  the amount is the money they take. Three lines need room under the ladder, so in landscape
  the plaque sits at 2% from the bottom instead of the bet's 3%.
- The chance of a pick is `GameConfig.winChance` (0.5 in the demo), sent by the server, not
  derived from the ladder and the RTP: the client does not hold the math. Without it the
  plaque says "Next win 7.92 FUN" with no chance. It is the chance of the next flip only,
  never of reaching a higher rung, which would read as better odds than the player has.
- Space cashes out (step 11), once per press. Focus a mouse click left on a button does not
  take Space from it, but a button reached with Tab keeps its own Space (keyboard players
  pick with it). Whether it was reached with Tab is tracked by the game (Tab sets it, a
  pointer press clears it), not read from `:focus-visible`: Chrome makes a clicked button
  `:focus-visible` the moment any key goes down, so Space after a click on an emblem went to
  the emblem (found in step 16). The keycap stands beside the plaque, not under it: the ladder leaves no
  room under the plaque in landscape. Hidden on touch and in portrait, as the arrow keys are.
- Emblems lower, the balance in the top left (step 14): asked for, and picked from three
  layouts compared side by side. The emblems, at 61% of the height and 12cqmin from the
  edges, sit beside the ladder and nearer the coin they bet on, and with their hop (up 15%,
  scale 1.16) stay clear of the coin, the ladder and the cash out. The top left corner is
  empty in landscape (the four tools take the top right); the top centre is out, since the
  coin with its hop reaches up to 13.6% of the height, right under the title. Checked at
  844 x 390, 1440 x 810 and 1920 x 1080, idle and with an open run.
- With the balance up top, a payout's coins would overshoot it near the end of their arc and
  leave the stage at the top (the stage clips). The arc's lift is capped by the balance's
  height on the stage, so they now come down onto it from within the plaque.
- The ladder hangs under the title sign (step 15), asked for: the rungs are the game, and
  the row of last flips there told the player nothing they could act on. It is part of the
  sign's column (`TitleSign` takes it as a child), so it follows the title's size. In
  landscape each rung is a bullet beside its multiplier, one line high, and the title moved
  up from 4.5% to 3.2%, so the ladder ends at 13.3% of the height.
- In portrait the ladder stays between the corner buttons, under the title, each bullet over
  its number. At first the eight labels ran into each other there ("×1.98×3.96..."), so only
  the next rung shows its "×" (the others keep it hidden for a screen reader, `.rung-x`), the
  bullets are a quarter bigger, and the rungs stand 2.2cqmin apart: at least 7 px between
  labels at 360 x 640, and 8 to 12 px clear of the corner buttons. A full-width row under the
  second row of corner buttons was turned down: it would sit on the resting coin (its top is
  at 18.9% of the height). Measured on the scene at 844 x 390 and 390 x 780: the coin at
  rest and in its tease stays clear (by 28 and 34 px); only at the top of a flip, blurred
  and spinning, does its rim reach under the ladder's lower edge (2 px in landscape, up to
  14 px in portrait, for a moment). With the balance in the top left corner the ladder
  clears it by 32 px at 844 x 390; the smoke test checks it never runs into the balance or
  the corner buttons.
- With the ladder gone from over the bet, the cash out stands at 3% from the bottom like the
  bet, not 2%.
- The last flips (step 15) are in the settings: history a player looks up, not a control.
  Newest first, each a list item named by its side for a screen reader. They are the
  client's record of this session, as before: a reload starts them empty. The provider's
  round history, which the shell does not show yet, is the real record.
- The settings panel has two columns in landscape (sound | speed and the last flips): one
  column ran 31 px past a 390 px tall screen.
- Choose, then BET (step 16), asked for: a tap on an emblem or ← → only chooses the side,
  and BET places the bet with it through the same `model.pick(side)` (`play({ bet, pick })`,
  the protocol is unchanged). A lone tap no longer stakes money, which a stray touch on a
  phone did before. The chosen side lives in `App` state, not in `RoundModel`: the server
  only hears of it with the bet. It starts empty in each session and stays chosen after a
  round, so the same side again is one tap on BET.
- In a run a tap on a side still flips at once, as in Stake's Hilo and Mines: a run is a
  string of quick decisions, and BET only starts the round. The emblems show no choice then
  (no dimming), since both are live, and the side tapped last becomes the chosen one for the
  next round.
- The chosen emblem stands raised (8% up, scale 1.1) with its green outline lit, no hop; the
  other stops hopping and dims to half, still one tap away. With nothing chosen they take
  turns hopping, as before. `aria-pressed` tells a screen reader which one is chosen.
- BET with no side sends nothing: the hint "Choose Sheriff or Outlaw first" appears between
  the emblems (a `role="status"` region, kept mounted so it is announced) until a side is
  chosen, and both emblems pulse once (scale 1.18, outline flashed, 0.7 s; two keyframe names
  so a second press restarts it). Reduced motion: no pulse, both outlines fully lit and still
  until a side is chosen.
- BET is the brightest control on screen: gold, in the title's letters. In landscape it
  stands right of the bet (the pair centred between the arrow keycaps), with a space bar
  keycap beside it; in portrait it runs 80cqmin wide under the bet, and the balance tab moved
  up over them (from 13% to 2.5% + 30cqmin from the bottom). Disabled while a round plays or a
  panel is open; with too little money it leads to the insufficient-funds notice, as a pick
  did. Checked at 360 x 640, 390 x 780 and 844 x 390, idle, with the hint and in a run; the
  smoke test checks the hint clears the balance, the bet and BET.
- Space and Enter press the one button in the middle at the bottom: BET between rounds, the
  cash out in a run. Enter cashing out too keeps one rule for that button.
- The cylinder dial is back (step 17), asked for: the one bet control, in place of
  − amount +, not a second one beside it (two controls for one value is clutter, and the
  player would not know which one counts). What step 9 found, that the dial alone did not
  read as the bet, is answered by a tab over the chosen chamber: "BET" and the amount with
  its currency, its pointer on the chamber. A tap on the tab opens the bet list and the
  field, as a tap on the amount did. The drum itself still turns by drag, flick, wheel, a
  tap on a bullet and, when focused, the arrow keys, Home and End; ↑ ↓ work from anywhere.
- With − amount + gone BET stands alone in the middle at the bottom, the spot the cash out
  takes in a run. In landscape the dial is half sunk into the bottom edge between BET and
  the Sheriff's → keycap (40cqmin, its right edge 33cqmin from the stage's), so BET's space
  bar keycap moved to BET's left. The tab stands over the drum, clear of the Sheriff star:
  its box overlaps the emblem's box by up to 3cqmin at the top of the hop, in the emblem's
  empty corner, never the star. In portrait the drum sits in the right edge at 83.2% of
  the height (42cqmin, left half showing) with the tab to its left, level with the balance
  tab on the other side (moved down from 2.5% + 30cqmin to 2.5% + 20cqmin), and BET is
  60cqmin wide instead of 80 so it clears the drum's lower half. Measured at 360 x 640,
  390 x 780, 844 x 390 and 1440 x 810, idle, with the "Choose Sheriff or Outlaw first"
  hint and its pulse: the drum clears BET by 2.5cqmin, the → keycap by 6, the hint by 9.5
  and more; the smoke test checks the balance, the tab, the chosen bullet and BET apart.
- In a run the dial is gone, not dimmed: the bet cannot change then, and in landscape the
  cash out plaque with its keycap takes the space the drum stood in. It rolls back in from
  the edge when the run ends (opacity and 25% travel, 220 ms; opacity only with reduced
  motion). While a single flip plays it stays, dimmed and locked.
- A typed bet between two levels is a stop on the drum, in its place (`dialStops`): the
  gold bullet under the tab always shows the real stake, never the nearest level, and one
  turn from it reaches the level above or below, as `nextLevel` does for the keys. When the
  typed stop leaves the drum (the bet went to a level), every amount keeps the chamber it
  had and the drum turns one chamber (`followDrum`); only a typed amount set from the list
  takes its chamber by index, which a jump from the list snaps to anyway. Under a finger the
  drum keeps the stops it had at the press, so dragging back over the typed amount finds it.
- The tick per chamber, the latch on rest and the recorded spin for a flick across two or
  more chambers are back (`UiSounds.spin`).
- `cylinder.webp` (140 KB) is back in the interface art the loader fetches first; the first
  load stays far under the 4 MB budget of `docs/LOW_END_CHECK.md`, whose table was not
  measured again.
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
7. Does the RGS accept arbitrary stakes, and with what minimum, maximum and step per
   currency? Until it says so, `customBet` stays off in a real integration and the game
   offers the levels alone.
8. Fonts come from Google Fonts. EU operators may reject requests to Google from inside
   the game (GDPR); self-host them before a real-money launch.
9. Can `OpenRun` carry `nextPrize`, what the next correct pick would pay, rounded as the
   server will pay it? Until then the client computes the next prize it shows during play
   (`rules.ts` `nextPrize`); a certified client should only display server money.
10. Can `GameConfig` carry `winChance`, the certified chance that one pick wins? The cash out
    shows it during play, and the rules text still says "half the time" in words; both should
    follow the math the provider certifies, and some markets may want it hidden.
