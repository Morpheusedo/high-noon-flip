# Preview link for the provider

A static build on Netlify that the provider opens in a browser: the game in demo
mode against the in-browser mock server, and the same build with the QA panel.

## Once per machine

The Netlify account is the team's; log in yourself, in a browser:

```bash
npx netlify-cli@27.10.2 login
npx netlify-cli@27.10.2 sites:create --name high-noon-flip-preview
```

`sites:create` links this folder to the new site (`.netlify/`, not committed). On a CI
box, set `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` instead.

## Each preview

Commit first, then:

```bash
npm run preview:deploy
```

It runs the checks and the smoke test, builds, and uploads `dist/` as a draft with its
own address named by version and commit, e.g.
`https://v0-1-0-a1b2c3d--high-noon-flip-preview.netlify.app`. That address never
changes, so a bug report against it names an exact build; the rules screen shows the
same version and build. `npm run preview:deploy -- --prod` also moves the site's main
address to this build, for a "latest" bookmark.

## What the link is and is not

- **Unlisted, not private.** Netlify's free plan has no password; the address is hard to
  guess and `X-Robots-Tag: noindex` keeps it out of search, but anyone with the link can
  open it. Send it to named people only. Delete old drafts in the Netlify dashboard when
  a build should stop being reachable. Password protection needs a paid plan.
- **Demo only.** The server is `MockServer` in the browser: no real money, no provider
  backend, the balance lives in the browser's storage.
- **Framing allowed.** No `X-Frame-Options`, so the provider can open it inside its test
  lobby to try the iframe embedding.
- **Fonts from Google.** See the open question on fonts in `docs/ROADMAP.md`.

## Message to the provider

> High Noon Flip, version 0.1.0, build a1b2c3d (also on the game's rules screen).
>
> - Game: https://v0-1-0-a1b2c3d--high-noon-flip-preview.netlify.app/
> - With the QA panel: the same link with `?debug=1`. The **QA** tab or the `` ` `` key
>   opens it: force outcomes and server errors, set the balance, jump to a multiply rung,
>   reload mid-round.
>
> Launch parameters work as from a lobby: `lang=ru`, `lobbyUrl=…`. The server is a mock
> in the browser; outcomes are random unless forced.
