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

### 18. Type the bet in its tab — done

The tab over the chosen chamber shows the amount alone: the word "BET" there repeated the
button beside it. With `customBet` one tap turns the tab itself into a field, in place: it
widens out of the tab with the bet selected, ✓ or Enter sets the bet (the checks of step 10,
with the message beside the field), Escape or a tap elsewhere leaves it as it was, and the
field lifts itself over a phone keyboard. Without `customBet` the tap opens the list of
levels, which no longer has a field. An amount below the minimum or above the maximum is not
refused: it becomes the lowest or the highest stake, with no message.

### 19. The ladder fits between the corner buttons — done

In portrait on a small stage the ladder ran under the corner buttons (6 px at 320 x 568,
about 20 px at 280 x 500): its px floors won below a stage of about 330 px. Now it fits the
width between the buttons: the gaps give way first, then the rungs, down to 9 px digits; on
a stage narrower still (a small iframe, split screen) it shows a window of rungs that slides
as the run climbs, with the top rung after an ellipsis. The corner buttons keep their size.

### 20. A long typed bet on the tab alone — done

A typed amount too long for its chamber of the drum is no longer squeezed in at a size no one
reads: the chamber holds a plain pencil mark, no bullet, and the tab over it names every digit
(9,999,999.99 FUN). A shorter one (12.35, 123.45) stays on the drum as before. Whether it fits
is measured on the stage, in any currency.

### 21. A showdown on the high rungs — done

The flip grows tense as the run nears the top, by the rung it would reach, never by its
outcome. A flip to the 5th or 6th rung of 8 is a duel: the light closes in on the coin (60%
around it), the music ducks by 8 dB, a slow heartbeat starts on the tap, and the coin slows
in the last third of its flight (+500 ms at 1x). A flip to the 7th or 8th is a showdown: all
that, a faster heartbeat, the camera pushes in on the coin (1.2x), a beat of near silence
before the landing and a sting on it (+900 ms at 1x). The controls dim, all but the ladder,
whose next rung glows. Everything lets go the moment the coin lands, or on an error.

### 22. A coin collection — done

Play unlocks coin skins, and the player wears one in place of the classic coin. Six skins:
Classic (always), Silver (50 flips), Rusty (rung 3 in three runs), Bullet-holed (a cash out at
×15.84 or higher), Gold (rung 5) and Lucky (the top rung). The five new coins' art was
generated in Gemini from the classic faces (prompts in `docs/COIN_ART_PROMPTS.md`), cut out
and framed like the classic coin at 1024 px, with each rim's colours taken from its art;
whether the provider accepts generated art is open question 14. Settings has a "Coins" section: unlocked coins are
chosen with a tap and the coin in the scene changes at once; a locked one is a silhouette with
the play that unlocks it. A new coin is announced after the result ("New coin: Gold"), and a
tap on the note opens the coins. The math does not change.

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
  server refuses. The demo takes 0.10 to 100.00 FUN in steps of 0.05 (5.00 to 100.00 since
  step 18).
- The field lives in the bet list, above the bullets: one place to change the bet (moved into
  the dial's tab in step 18). It
  reads the number in the player's language (`parseAmount` in `shell/money.ts`): the
  language's decimal mark, its grouping, and a lone other mark as a decimal one when it
  cannot be grouping ("7,35" in English), since a phone keyboard offers the device's mark,
  not the game's. More decimals than the currency has is not an amount (JPY "1.5").
- Below the minimum, above the maximum or above the balance: a message with the limit as
  an amount, and the dialog stays (step 18, asked for: out of range is clamped instead, see
  below; the balance keeps its message). Off the step: rounded down to the grid, shown in the
  field with a note, and OK once more makes it the bet. A stake is never changed silently.
- − and + (and ↑ ↓) still step through the levels; from a typed amount between two levels
  they go to the next one up or down. The dial (step 17) and ↑ ↓ keep this rule. "Lower the bet" after insufficient funds offers the
  highest level the balance covers, and the balance on the grid only below every level:
  never an odd all-in amount while a level fits.
- With a phone keyboard up the bet list pads itself into the visible part of the stage (step
  18: the field in the tab lifts itself instead, by the same rule)
  (`visualViewport`) and shows only the title and the field. It follows the viewport, not
  the focus: a tap on OK blurs the field, and a layout that moved on blur would move OK from
  under the finger. Checked with a simulated viewport; a real phone keyboard is still on the
  device checklist.
- One tap on the bet puts the player in the field (step 13; the field is the tab itself since
  step 18): the field opens focused with
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
  the list, so the bullets come back one tap after the field; a second tap outside closes it
  (gone in step 18: the list has no field, and a tap outside the tab's field cancels it).
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
- The ladder fits itself (step 19), measured, not set by breakpoints: its `max-width` in
  portrait is the room between the corner buttons (`--tool`, now set on `.hud`, less a
  clearance of max(6 px, 2.4cqmin) each side), and `useFitLadder` (hooks.ts) measures the
  rungs and applies `fitLadder` (ladderFit.ts). The gaps and padding give way first, to 4 px;
  then the rungs (digits and bullets together), to 9 px digits, the smallest that still reads
  on a phone. At 320 x 568 the gaps alone nearly do it (8 rungs, 9.8 px digits, 7 px clear of
  the buttons); 360 x 640 and up, and landscape, are as before.
- Below 9 px a window of rungs takes the row (280 x 500: 5 of 8). It shows the last climbed
  rung, the next one and the ones after it, then "…" and the top rung, the maximum win, which
  a player should always see; near the top it closes up into the last rungs in a row. The
  count is worked out with the widest rung, so it stays the same while the run climbs. The
  rungs left out stay in the list for a screen reader (visually hidden, like the "×"), and the
  ellipsis is `aria-hidden`. Turned down: smaller corner buttons (they are touch targets, 36 px
  already), the ladder under the buttons or in two rows (on the resting coin, see step 15).
- The ladder in landscape has no `max-width`: between the balance and the four buttons it has
  room down to the smallest landscape stage the smoke test runs (640 x 360). A tiny landscape
  iframe would want the same fit, with the balance's width as the left edge.
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
- The tab names the amount alone (step 18), asked for: "BET" over the drum repeated the gold
  BET button beside it, two things with one name. The pointer on the chamber and the bullets
  around it say this is the bet; a screen reader still hears "Bet 1.00 FUN" (`aria-label`).
  Dropped in Russian too, though there the button says "Поставить": one layout for every
  language, and a word in the tab would need room in each of them.
- Typing goes into the tab itself (step 18), asked for: no dialog. One tap on the amount and
  the tab widens into "[ 1.00 FUN ] ✓" in place, the amount selected, with the iOS stand-in
  of step 13 so a phone raises its keyboard from the tap. The field grows out of the tab's
  box (a `transform` from the tab's size and place to its own, 200 ms; its contents fade in
  once it is wide enough) and shrinks back into it on the way out (160 ms); opacity only with
  reduced motion. Web Animations, not CSS: the start depends on the tab's measured box, and
  the way back must finish before the tab returns.
- With `customBet` the tab has no way to the list (step 18): the list was the quick way to a
  far level, and typing the amount is quicker still; the drum turns through the levels as
  before. A second button beside the field would crowd a tab that must fit between the
  balance and the drum in portrait. Without `customBet` (the default in a real integration
  until the provider answers question 7) the tab opens the list, which lost its field.
- The checks are those of step 10, now `checkTypedBet` (`typedBet.ts`), tested apart from the
  field: below the minimum, above the maximum or above the balance, a message and the field
  stays open; off the grid, rounded down and shown with a note, and ✓ once more sets it. The
  message stands beside the field (left of it in landscape, over the empty top of BET; above
  it in portrait, under the Sheriff), outside its box, so the field does not jump.
- Out of range, the typed amount is clamped, not refused (step 18, asked for): below the
  minimum it becomes the lowest stake, above the maximum the highest (3 is 5.00 FUN, 5000 is
  100.00 FUN in the demo), set at once and shown in the tab like any accepted amount, with
  no message. The nearest stake the server takes in that direction: the range's end on its
  grid, or a level beyond the range if one is nearer. The client still never sends a stake
  out of range (the server would answer INVALID_BET); the clamp is the check. Not an amount
  is still refused, a rounding onto the grid is still shown and confirmed, and above the
  balance keeps its message: that is the player's money, not a limit of the game, and a
  quiet cut to the balance would be an all-in they did not ask for. The rules screen still
  names the range.
- The demo's lowest bet is 5.00 FUN (step 18, asked for), levels and typed stakes alike:
  levels 5.00, 7.50, 10, 25, 50 and 100 (still six, one per chamber), the default 5.00, typed stakes from 5.00 to 100.00 in steps of 0.05. It
  is the mock server's config only: in production the operator sends the levels, the default
  and the range per currency, and the client reads them as before. The rules screen follows
  ("Bets from 5.00 FUN to 100.00 FUN").
- Enter, ✓ and Escape close the field and give the focus back to the tab; a tap elsewhere
  cancels on the press and then does what it was for (turns the drum, chooses a side), but
  BET is disabled while the field is open and the game's keys (↑ ↓, Space, Enter, ← →) are
  the field's, so nothing is staked with an amount the player was still changing. ✓ keeps
  the focus in the field on the press, so a phone keyboard stays up and nothing moves from
  under the finger before the click.
- In landscape the field keeps the tab's right edge and grows to the left: centred, its ✓
  came within 10 px of the Sheriff star, which still hops. To the left it stands over BET's
  empty top (22 px clear of BET at 844 x 390). In portrait it keeps the tab's right edge as
  well, with 35 px to the balance at 360 x 640. Checked at 360 x 640, 390 x 780, 844 x 390
  and 1440 x 810, idle, open with a message, and in a run (the dial is gone then, as before).
- Over a phone keyboard the field lifts itself (`useKeyboardLift`): it measures its wrapper,
  which the lift does not move, against the visual viewport, and translates up by the part
  hidden plus 10 px; lifted, its pointer is hidden. Checked with a simulated
  `visualViewport` at 360 x 640; a real phone keyboard stays on the device checklist.
- The stage is `overflow: clip`, not just hidden: focusing the field scrolled the
  hidden-overflow stage by 73 px to show the drum's sunk half, and the whole scene moved up.
- QA: `?debug=1&bets=levels` starts the test server without `customBet`, so the smoke test
  (and QA) can reach the list. A test-server switch, as the QA panel is; never with
  `mode=real`.
- A long typed bet (step 20), asked for: an amount with more digits than a chamber holds is
  not squeezed into it. The rule is measured, not a count of digits (`chamberFit` in
  `dial.ts`, `useChamberFit` in hooks.ts): a hidden chamber holds the amount at the chamber's
  font, and it fits if it can shrink into the chamber's width without going under 9 px or 60%
  of the chamber's font, so it never looks lost beside the levels. At 844 x 390 and 360 x 640
  "123.45" fits (10 to 11 px digits), "1,234.56" does not; a large desktop stage takes
  longer ones. Only a typed amount is measured: the levels keep their compact "10K", but a
  typed stake shows every digit (`fmt.exact`, never "12.3K" for 12,345.67) or none, since the
  gold bullet always shows the real stake. JPY and BTC go through the same formatter and the
  same measure.
- What stands in the chamber was asked: a pencil (✎), over a word ("CUSTOM", which would need
  room in every language) or a blank chamber (read as the end of the drum). It is an inline
  SVG, not the ✎ character, which a low-end Android font may lack, so it needs no
  dictionary entry. No bullet under it: a plain mark on the cylinder's metal, with the chosen
  chamber's ring and glow so the tab still points at the stake. The chamber is
  `aria-hidden` as before; a screen reader hears the amount from the slider's value and the
  tab's name.
- The tab names every digit: its amount gets a smaller font instead of a wider tab past
  40cqmin (36cqmin in portrait, which keeps it 3.5cqmin and more off the balance), through
  `useFitText`, as the balance does. 9,999,999.99 FUN needs no shrinking at 360 x 640 (17 px
  clear of the balance). In landscape the tab now keeps the right edge a 20cqmin tab has over
  the chamber and grows to the left, over BET's empty top, as the field does: centred, the
  long tab ran under the Sheriff star. A tab of the usual width stands where it stood.
- QA: `?debug=1&bets=wide` gives the test server typed stakes up to 10,000,000.00 FUN in steps
  of 0.01 and a balance of 20,000,000.00, under its own storage key so it never mixes with the
  demo's session; the demo's own range ends at 100.00, so a long amount cannot be typed there.
- The coin collection (step 22): unlocks come from play only, never from the stake or money
  spent, so a 5.00 run to rung 5 counts as a 100.00 one and nothing pushes a bigger bet;
  operators and regulators reject rewards for spending. The rules are counted from round
  results the model shows (`unlock.ts` `eventsOf` on the step into `result`), never from
  timers. A flip the server settled but the client never showed (a lost answer, NETWORK)
  does not count; that is rare and cosmetic.
- Rules live in `public/assets/images/coins/coins.json` with the art: `{ "flips": 50 }`,
  `{ "rung": 5 }`, `{ "rung": 3, "runs": 3 }`, `{ "rung": "top" }` (the last rung of the
  ladder the server sends) and `{ "cashout": 4 }` (a cash out at rung 4 or higher; the top
  rung paying out by itself counts). The manifest is checked on load and by a unit test; a
  rule naming a stake is refused. A cash out rule names a rung, not a multiplier, so it holds
  for any ladder; the text shows that rung's multiplier from the config ("×15.8").
- A run is counted once per rung: the progress keeps the last run's id and its best rung, so a
  run resumed after a reload is not counted twice, and a run opened high by the test server
  (`openRunAt`) counts every rung under the one it reaches. Several unlocks at once are told
  one after another.
- Progress and the chosen coin sit behind `CollectionStore` (`load`, `save`, both async so a
  provider's profile API fits), with `localCollectionStore` on localStorage (`hnf.coins`) now.
  A saved value is checked field by field, as the settings are; a chosen coin that is locked
  or gone becomes the classic one. Unlocked coins stay unlocked when a rule changes; a rule
  made easier unlocks quietly at the next start. Progress kept in the browser is lost on
  another device or after clearing it: see open question 13.
- Loading: the chosen coin's faces load with the game, in place of the classic ones (still
  two images); another coin's faces load when it is chosen, and the icons when the settings
  open. The coin keeps its old faces until the new ones arrive, then changes at once, even
  mid-flip. Missing art for a chosen coin is not a loading error, unlike the rest of the
  art: the classic faces stand in and the console warns; a missing icon shows the classic
  icon. Only a missing classic coin stops the game, as any scene art does.
- Each skin is two faces (`<skin>-sheriff.webp`, `<skin>-outlaw.webp`, in the classic coin's
  640 x 640 frame and face inset; 1024 x 1024 once question 12 is answered), a 128 px icon
  (`<skin>-icon.webp`) and the rim's three colours (shade, light, streak), which the scene
  draws in code. The classic faces moved into `coins/` as `classic-*.webp`. The placeholders
  are the classic coin tinted by `scripts/coin-placeholders.sh` (ImageMagick): silver
  desaturated, gold warmer, rusty brown and grainy, bullet-holed with three holes, lucky
  green. It only writes missing files, so real art dropped in is never overwritten.
- The note "New coin: Gold" waits for the round to be idle and no panel to be open: never
  over a flip, a result stamp or a dialog. It stands under the ladder, far from the cash out
  and BET; it covers the top edge of the resting coin for its 4.5 s. A round that
  starts hides it, and it comes back afterwards for the rest of its time. It slides down and
  fades in (220 ms); with reduced motion it only fades. A `role="status"` region announces it.
  The settings it opens put the focus on the chosen coin and scroll the coins into view.
- The settings panel has three columns in landscape (sound | speed and the last flips |
  coins) and is wider (94%, 210cqmin); a panel taller than the stage scrolls. In portrait the
  coins come last. Checked at 390 x 780 and 844 x 390.
- The coin section and the rules say the coins change only how the coin looks, never the
  odds or the payouts.
- Code, comments and README in English (they ship to the provider); chat in Russian.
  `README.ru.md` is the team's copy; keep both READMEs in step.

- The showdown (step 21) lives in `game/tension.ts`: the thresholds, as rungs from the top
  of whatever ladder the config sends (a duel on the last four, a showdown on the last two),
  and every duration, light, zoom and dB of it. The level comes from the rung the flip would
  reach (`openRun.step + 1`), never from the outcome: the outcome is known while the coin
  flies, and a winning flip that looked different from a losing one would give it away and
  read as a fake near-miss. The sting is the same on a win and a loss. The first flip of a
  round is never tense, even on a short ladder: it is a fresh stake, not a climb.
- It runs from the tap (BET or a pick) to the landing only. On the result, on an error, when
  the director stops, and after a reload (the director starts calm; only a pick closes in)
  everything goes back: scene, music, heartbeat, interface. While the player decides whether
  to cash out there is no heartbeat and no darkening: that would be pressure to play on,
  which providers and regulators reject. A cash out is never a showdown.
- Speeds: 2x keeps everything with the slowdown and the push-in half as long; 4x keeps only
  the darkening (scene and interface), as its whole flip lasts under half a second. Reduced
  motion: no push-in and no slow motion; the darkening and the sound stay. The near silence
  takes at most half the flight (the 500 ms reduced-motion flip). `minRoundMs` still counts
  from the bet and only ever lengthens the result.
- The scene is a camera container (everything but the overlays) scaled toward the top of the
  coin's flight, so the coin never rises closer to the ladder than it did; the rest moves
  down and out. The darkening is one pre-drawn spotlight sprite (`fx.spotlight`) whose alpha
  rises to 0.4, clear for 1.25 coin radii around the middle of the flight and full at twice
  that. Transforms and an alpha only, no live filter (low-end Android). A rotation mid-flip
  rebuilds the scene straight into the showdown's end state.
- The flight's slow motion is a time map (`tween.ts` `slowLastThird`): the first two thirds
  run as before, then a cubic that leaves the cut at the old speed, slows, and picks up a
  little to land; the coin's height and spin curves are unchanged, only their clock.
- The interface's controls sit in one layer, `.controls`, the same box as `.hud`, dimmed to
  the same 60% as one: the emblems, the drum and the cash out keep their own opacity for
  their own states, so a rule on each would have fought them. While dimmed the layer stacks
  under the title sign; nothing overlaps the sign then. The next rung glows copper, not gold:
  gold would claim it is won. Times and light reach the CSS as `--tension-ms` and
  `--tension-light` from the director's tension store.
- The music ducks on a gain node of its own between the filter and the music bus
  (`AudioManager.duckMusic`), apart from the player's volume. The heartbeat is one lub-dub
  per cue, repeated by the game at its tempo (60 and 100 per minute), and skipped while sound
  is not running, so beats never pile up in a hidden tab.
- Coin sharpness at the push-in (checked in Chrome at 390 x 780 and 844 x 390, 3x): on a phone
  the canvas renders at 2x at most, so the coin is drawn at about 450 px even pushed in, under
  the art's 640: no softer than the rest of the canvas. On a desktop at 2x (1600 x 900) or a
  tablet the pushed-in coin needs about 720 px, so it is upscaled by some 12% there; see the
  open question for the artist.

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
11. Sound for the showdown (step 21): the provider's sound designer should record
    `heartbeat-slow` and `heartbeat-fast` (one lub-dub each, under 0.5 s, the game repeats
    them at 60 and 100 per minute) and `showdown-sting` (about 1 s, the same on a win and a
    loss), with licenses for distribution in the game. Until then they are synthesized
    placeholders in `game/sound.ts`; a recording added to `assets-src/audio/sfx` under the
    same cue and built with `npm run audio` replaces each.
12. Coin art at 1024 px: the showdown pushes in 1.2x, and on a desktop or a tablet the coin
    then needs about 720 px, more than the 640 px faces have. The artist should supply the
    Sheriff and Outlaw faces at 1024 x 1024.
13. The coin collection (step 22) keeps its progress in the browser: it is lost on another
    device or after clearing the browser, a real complaint from players. Can the provider
    keep it in the player's profile on its side? `CollectionStore` is the one place to
    change. And do any target markets restrict achievements or collectibles in a gambling
    game? If so, it becomes a `Jurisdiction` flag that hides the section and the note.
14. Does the provider accept art generated by an AI model? The five collection coins were made
    in Gemini from the classic faces. Some providers require that they own the rights to every
    asset, and generated images may not be protected by copyright in some countries. Fine for
    the concept; before a release the coins either get a yes or are redrawn by an artist.
