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
`?lang=de&mode=demo&debug=1&lobbyUrl=https://casino.example`. With `debug=1` the mock
server is available in the console as `hnf.server`, for example
`hnf.server.forceOutcomes('sheriff', 'sheriff')` or `hnf.server.failNext('NETWORK')`.

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
│  └─ store.ts        observable state; useStore.ts connects it to Preact
└─ game/
   ├─ model/          RoundModel: the round state machine, the source of truth
   ├─ director.ts     turns phase changes into animations, reports back when done
   ├─ scene/          PixiJS: everything drawn on the canvas
   └─ ui/             Preact: the HTML interface over the canvas
tests/                unit tests for the model, the server mock and the shell
docs/ROADMAP.md       the plan, what is done, and the decisions taken
public/assets/        images and sounds, served as they are
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

## Stack

TypeScript (strict), Vite, PixiJS 8, Preact, Vitest, ESLint, Prettier.
Versions are pinned exactly in `package.json`.
