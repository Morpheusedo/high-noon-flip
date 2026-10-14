# High Noon Flip

[Русская версия](README.ru.md)

A western coin flip: pick Sheriff or Outlaw, the revolver fires and flips the coin.
Two modes: **Instant** (one flip, pays 1.98x) and **Multiply** (each correct pick doubles
the prize up to 253.44x; cash out at any time).

`prototype/` holds the original single-file prototype. It is the reference for how the
game should look, sound and feel; it is not part of the build.

## Commands

| Command             | What it does                               |
| ------------------- | ------------------------------------------ |
| `npm install`       | Install dependencies                       |
| `npm run dev`       | Dev server at http://localhost:5173        |
| `npm test`          | Unit tests (Vitest)                        |
| `npm run typecheck` | TypeScript check                           |
| `npm run lint`      | ESLint                                     |
| `npm run format`    | Prettier                                   |
| `npm run build`     | Type check, then a static build in `dist/` |

Launch parameters go in the URL, as an operator would pass them:
`?lang=de&mode=demo&debug=1&lobbyUrl=https://casino.example`. With `debug=1` (demo mode
only) the console has `hnf.server` (the mock server: `hnf.server.forceOutcomes('sheriff')`,
`hnf.server.failNext('NETWORK')`), `hnf.scene` (`hnf.scene.turnCoin()`, `hnf.scene.win(5)`)
and `hnf.settings` (`hnf.settings.set({ speed: 4 })`).

## How the client is built

```
src/
├─ main.ts            boot: launch params → server → scene + interface
├─ server/
│  ├─ protocol.ts     the contract with the game server (RGS); start here
│  └─ mockServer.ts   in-browser stand-in for the RGS, with QA controls
├─ shell/             parts every game needs; will move to a shared package
│  ├─ launchParams.ts reading and validating the launch URL
│  ├─ money.ts        minor units → "€198.00" for any currency and language
│  ├─ assets.ts       asset URLs that work under any CDN path
│  ├─ settings.ts     the player's settings (play speed) and the turbo rule
│  └─ store.ts        observable state; useStore.ts connects it to Preact
└─ game/
   ├─ model/          RoundModel: the round state machine, the source of truth
   ├─ director.ts     turns phase changes into animations, reports back when done
   ├─ timing.ts       every duration of a round, scaled by speed in one place
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
      ├─ Notices.tsx      result stamp, insufficient funds, errors
      ├─ text.ts          every string the interface shows
      └─ art/             interface images, bundled and hashed by Vite
tests/                unit tests for the model, the director, the server mock and the shell
docs/ROADMAP.md       the plan, what is done, and the decisions taken
public/assets/        scene images and sounds, loaded by Pixi at run time
   └─ images/scene-layout.json  positions on the stage and measurements on the art
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

## Stack

TypeScript (strict), Vite, PixiJS 8, Preact, Vitest, ESLint, Prettier.
Versions are pinned exactly in `package.json`.
