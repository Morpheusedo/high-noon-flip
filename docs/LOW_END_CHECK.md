# Low-end phone check

Casino traffic is mostly mobile, and a large share is cheap Android phones. Providers
and operators test on them, and a game that stutters or loads for half a minute there
is sent back. This is how the build is checked: a simulation on every release, and a
real phone before a build goes to the provider.

## 1. Simulation: `npm run lowend`

Builds, then plays the game in installed Google Chrome with the DevTools protocol
slowing it down: a Moto G4 screen (360 x 640 at 3x), the CPU 4x slower and Lighthouse's
mobile network (150 ms round trip, 1.6 Mbit/s down). It loads the game, counts frames
at rest, during a round and during a showdown on the high rungs at normal speed, plays 20
more rounds and compares the JavaScript heap. It prints a report and fails past these budgets:

| Measure                                 | Budget |
| --------------------------------------- | ------ |
| Navigation to the game taking input     | < 12 s |
| Bytes downloaded until then             | < 4 MB |
| Sound downloaded before the game is up  | none   |
| JS heap growth over 20 rounds, after GC | < 5 MB |

`CPU_SLOWDOWN=6 npm run lowend` for a weaker phone. Without Google Chrome installed,
`LOW_END_BROWSER=bundled` uses Playwright's own browser, whose WebGL is software:
the load and memory figures still hold, the frame rate does not.

What a simulation cannot do: slow the GPU. The desktop graphics card draws every
frame, so the frame rate here is an upper bound. Only a phone tells the truth about
frames, heat and memory pressure.

### Results

Build 0.1.0 on a MacBook (Intel UHD 630), 2026-10-14:

| Measure                           | CPU 4x              | CPU 6x                                   |
| --------------------------------- | ------------------- | ---------------------------------------- |
| Ready to play                     | 9.4 s               | 9.7 s                                    |
| First load                        | 1510 KB, 37 files   | 1510 KB, 37 files                        |
| Frames at rest                    | 60 fps              | 59 fps                                   |
| Frames during a round             | 59 fps, worst 33 ms | 54 fps, 3 frames over 50 ms, worst 67 ms |
| JS heap, before → after 20 rounds | 6.2 → 7.2 MB        | 6.2 → 7.2 MB                             |

Build 0.1.0 with the showdown (step 21), same MacBook, CPU 4x, 2026-10-20. The report now
also counts frames during a showdown from the 6th rung at normal speed (push-in, darkening,
slow motion):

| Measure                           | CPU 4x              |
| --------------------------------- | ------------------- |
| Ready to play                     | 9.9 s               |
| First load                        | 1539 KB, 38 files   |
| Frames at rest                    | 60 fps              |
| Frames during a round             | 58 fps, worst 67 ms |
| Frames during a showdown          | 58 fps, worst 33 ms |
| JS heap, before → after 20 rounds | 7.0 → 7.4 MB        |

A first run on the same day, with the machine busy (load average 13), gave 38 fps even at
rest; the showdown then was no slower than a plain round (47 against 37 fps).

At 1.6 Mbit/s the network is most of the wait: 1.5 MB takes about 7.5 s on its own.

Fixed after the first run:

- **Sound took bandwidth from the art.** The 1.2 MB of sound started with everything
  else; it never held the loader, but it shared the line with the art the game cannot
  start without. Ready to play went from 11.9 s to 9.4 s once sound started after the
  game was up.
- **Interface art came in after the loading screen.** The plaques, emblems and bet dial
  are CSS images, so the browser fetched them only when the interface appeared, and they
  filled in for 2.5 more seconds. The loader now fetches them first (`game/ui/art.ts`).

Next savings, not done yet:

- Load only the background for the current orientation: −200 KB on the first load.
- Music as mono 64 kbit/s, or Opus once there is an encoder: about half of its 950 KB.

## 2. Simulation by hand: Chrome DevTools

To look at one problem closely:

1. `npm run build && npm run preview`, open http://localhost:4173/?debug=1.
2. DevTools → device toolbar, Moto G4 or a phone the provider names.
3. Network tab: tick **Disable cache**, throttling **Slow 4G** (or **3G** for the worst case).
4. Performance tab → ⚙: CPU **4x** or **6x slowdown** (or the calibrated **Low-tier
   mobile** preset where Chrome offers it).
5. Record a reload, then a few rounds. In the recording look for long tasks (red
   corners) during the flip and the win effects.
6. Rendering drawer: **Frame rendering stats** shows the frame rate live.
7. Memory tab: a heap snapshot after loading and another after 20 rounds (`hnf.server`
   can force them); compare for objects that keep growing.

## 3. A real phone

Before a build goes to the provider, and after any change to the scene or effects.

**Phone:** a low-end Android from the last four years, 2 to 3 GB of RAM, Android 10 to
12, Chrome up to date. For example Samsung Galaxy A12, Xiaomi Redmi 9A, Motorola Moto
E/G. Add an iPhone 8 or SE (2nd gen) for Safari if the provider targets iOS.

**Setup:** USB debugging on, phone on USB, `chrome://inspect` on the computer gives
DevTools for the phone's tab. Open the preview link, or `npm run preview -- --host` and
the computer's address on the same Wi-Fi.

| Check                    | How                                                           | Pass                                                                                          |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Cold load on mobile data | Clear site data, 4G, stopwatch from tap to the bet            | under 10 s; under 5 s on Wi-Fi                                                                |
| Frames at rest           | Remote DevTools → Rendering → Frame rendering stats           | 50+ fps                                                                                       |
| Frames in a round        | Same, through flips, a long win, a 5-rung multiply run        | never under 30 fps; no visible hitch                                                          |
| Memory                   | Remote DevTools → Memory, after load and after 50 rounds      | JS heap grows < 5 MB                                                                          |
| Tab memory               | `adb shell dumpsys meminfo com.android.chrome` (renderer PSS) | under 300 MB                                                                                  |
| Heat                     | 10 minutes of play, phone in hand                             | warm is fine; frames hold for 10 min                                                          |
| Bundle                   | `npm run size`                                                | within the provider's budget                                                                  |
| Rotation                 | Turn the phone mid-round and at rest                          | layout fits; the round finishes                                                               |
| Background and back      | Lock the phone mid-round, unlock; switch apps and back        | sound stops and resumes; round ends; scene draws (no black canvas after a lost WebGL context) |
| Low memory               | Open the game, then a few heavy apps, return                  | the tab reloads into the open run                                                             |
| Sound                    | First tap unlocks; mute button; volume sliders                | no crackle, no delay over ~100 ms                                                             |
| Typed bet                | One tap on the bet, both orientations, type 7,35 and 7.35     | keyboard up from that tap; typing replaces the bet; in sight; a tap outside shows the bullets |

Check the typed bet on the iPhone too where the provider targets iOS: Safari raises the
keyboard only from a tap, and a regression there shows on no Android phone.

Write the results into the table under **Results** above with the phone's model, Android
and Chrome versions, the build (rules screen: version and build) and the date.

Budgets here are our defaults. A provider usually has its own (size, load time, list of
devices): see the open questions in `docs/ROADMAP.md`.
