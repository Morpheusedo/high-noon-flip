/**
 * The director turns phase changes into presentation and tells the model when
 * each part is over.
 *
 *   requesting  the hammer goes back while the request is on its way
 *   revealing   the shot, the coin flies and lands on the server's outcome → finishReveal()
 *   result      win or loss effects and sound, then a pause → finishResult()
 *   error       the hammer comes down without a shot
 *
 * On the high rungs a pick is a showdown (`tension.ts`): it closes in from the
 * tap and lets go the moment the coin lands, or on an error. The level comes
 * from the rung the flip would reach, never from its outcome, and nothing of it
 * lasts into the time the player decides whether to cash out.
 *
 * It waits for the scene's animations, which run on the scene clock, so a
 * hidden tab pauses the round instead of skipping it. Speed is read once per
 * round, so changing it mid-round takes effect on the next one.
 */
import type { Flip, Side } from '../server/protocol';
import { allowedSpeed, type Settings, type Speed } from '../shell/settings';
import type { Store } from '../shell/store';
import type { Outcome, RoundModel, RoundState } from './model/RoundModel';
import type { RoundSounds } from './sound';
import { CALM, tensionFor, tensionLevel, type Tension } from './tension';
import { timingsFor, type HoldKind } from './timing';

/** What the director needs from the scene. `GameScene` implements it; tests pass a fake. */
export interface Presenter {
  readonly reducedMotion: boolean;
  /** Hammer back; resolves after `ms`, when the gun is ready to fire. */
  cock(ms: number): Promise<void>;
  release(): void;
  fire(spinMs: number, pace: number): void;
  /** Resolves after `ms + slowMs`; the slow motion is in the flight's last third. */
  flip(side: Side, ms: number, turns: number, slowMs: number): Promise<void>;
  /** The showdown closes in. */
  tension(t: Tension): void;
  /** Back to calm over `ms`. */
  calm(ms: number): void;
  win(level: number): void;
  lose(): void;
  /** Resolves after `ms` of scene time. */
  wait(ms: number): Promise<void>;
}

/** Biggest win effect level. */
export const MAX_WIN_LEVEL = 5;

/**
 * Starts presenting `model`'s rounds; returns a function that stops it.
 * `tension` tells the interface about a showdown, so it can dim its controls.
 */
export function startDirector(
  model: RoundModel,
  scene: Presenter,
  sounds: RoundSounds,
  settings: Store<Settings>,
  tension: Store<Tension>,
  now: () => number = () => performance.now(),
): () => void {
  /** Bumped on every phase change; an animation that finishes late checks it before reporting. */
  let generation = 0;
  let timings = timingsFor(currentSpeed(), scene.reducedMotion);
  let cocked: Promise<void> = Promise.resolve();
  let startedAt = now();
  let stepBefore = 0;

  function currentSpeed(): Speed {
    return allowedSpeed(settings.get().speed, model.state.jurisdiction.turboAllowed);
  }

  /** The showdown of a pick from `state`, by the rung it would reach. */
  function tensionOf(state: RoundState, speed: Speed): Tension {
    const rung = (state.openRun?.step ?? 0) + 1;
    return tensionFor(tensionLevel(rung, state.config.ladder.length), speed, scene.reducedMotion);
  }

  function closeIn(t: Tension): void {
    if (t.level === 0) return;
    tension.set(t);
    scene.tension(t);
    sounds.tension(t);
  }

  /** Lets go of any showdown: on the landing, an error, or when stopped. */
  function letGo(): void {
    const t = tension.get();
    if (t.level === 0) return;
    // calm, with the time it takes to get there, for the interface to fade back
    tension.set({ ...CALM, outMs: t.outMs });
    scene.calm(t.outMs);
    sounds.calm(t.outMs);
  }

  async function reveal(gen: number, flip: Flip): Promise<void> {
    await cocked;
    if (gen !== generation) return;
    const t = tension.get();
    scene.fire(timings.spinMs, timings.pace);
    // the cylinder only spins with full motion, so its sound does too
    sounds.shot(scene.reducedMotion ? null : timings.spinMs);
    const inAir = timings.flipMs + t.slowMs;
    const landed = scene.flip(flip.outcome, timings.flipMs, timings.turns, t.slowMs);
    if (t.hushMs > 0)
      // a beat of near silence before the landing, never more than half the flight
      void scene.wait(inAir - Math.min(t.hushMs, inAir / 2)).then(() => {
        if (gen === generation) sounds.hush(t);
      });
    await landed;
    if (gen !== generation) return;
    sounds.land();
    if (t.sting) sounds.sting();
    model.finishReveal();
  }

  async function show(gen: number, state: RoundState, outcome: Outcome) {
    const { kind, level } = celebration(state, outcome, stepBefore);
    if (outcome.kind === 'lose') {
      scene.lose();
      sounds.lose();
    } else {
      scene.win(level);
      sounds.win();
    }
    // the market's shortest round counts from the bet; any shortfall extends the result
    const shortfall = state.jurisdiction.minRoundMs - (now() - startedAt);
    await scene.wait(Math.max(timings.hold[kind], shortfall));
    if (gen === generation) model.finishResult();
  }

  const unsubscribe = model.store.subscribe((state, previous) => {
    const { phase } = state;
    if (phase.name === previous.phase.name) return;
    const gen = ++generation;
    switch (phase.name) {
      case 'requesting': {
        const speed = currentSpeed();
        startedAt = now();
        stepBefore = state.openRun?.step ?? 0;
        timings = timingsFor(speed, scene.reducedMotion);
        // a cash out is no flip, and no showdown
        if (phase.pick) {
          closeIn(tensionOf(state, speed));
          sounds.cock();
        }
        cocked = phase.pick ? scene.cock(timings.cockMs) : Promise.resolve();
        break;
      }
      case 'revealing':
        void reveal(gen, phase.flip);
        break;
      case 'result':
        letGo();
        void show(gen, state, phase.outcome);
        break;
      case 'error':
        scene.release();
        letGo();
        break;
      case 'idle':
        letGo();
        break;
    }
  });
  return () => {
    generation++;
    unsubscribe();
    letGo();
  };
}

/**
 * How big the result looks and how long it stays. `stepBefore` is the number
 * of correct picks in the run before this request.
 */
export function celebration(
  state: RoundState,
  outcome: Outcome,
  stepBefore: number,
): { kind: HoldKind; level: number } {
  switch (outcome.kind) {
    case 'lose':
      return { kind: 'lose', level: 0 };
    case 'step':
      // the first few rungs of a run stay modest; the cash out is the big moment
      return { kind: 'step', level: Math.min(2, (state.openRun?.step ?? 1) - 1) };
    case 'win':
      // a cash out, or the top rung of a run
      return { kind: 'cashout', level: Math.min(MAX_WIN_LEVEL, stepBefore + 1) };
  }
}
