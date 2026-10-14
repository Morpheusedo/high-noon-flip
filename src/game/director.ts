/**
 * The director turns phase changes into presentation and tells the model when
 * each part is over.
 *
 *   requesting  the hammer goes back while the request is on its way
 *   revealing   the shot, the coin flies and lands on the server's outcome → finishReveal()
 *   result      win or loss effects and sound, then a pause → finishResult()
 *   error       the hammer comes down without a shot
 *
 * It waits for the scene's animations, which run on the scene clock, so a
 * hidden tab pauses the round instead of skipping it. Speed is read once per
 * round, so changing it mid-round takes effect on the next one.
 */
import type { Flip, Side } from '../server/protocol';
import { allowedSpeed, type Settings } from '../shell/settings';
import type { Store } from '../shell/store';
import type { Outcome, RoundModel, RoundState } from './model/RoundModel';
import type { RoundSounds } from './sound';
import { timingsFor, type HoldKind, type Timings } from './timing';

/** What the director needs from the scene. `GameScene` implements it; tests pass a fake. */
export interface Presenter {
  readonly reducedMotion: boolean;
  /** Hammer back; resolves after `ms`, when the gun is ready to fire. */
  cock(ms: number): Promise<void>;
  release(): void;
  fire(spinMs: number, pace: number): void;
  flip(side: Side, ms: number, turns: number): Promise<void>;
  win(level: number): void;
  lose(): void;
  /** Resolves after `ms` of scene time. */
  wait(ms: number): Promise<void>;
}

/** Biggest win effect level. */
export const MAX_WIN_LEVEL = 5;

export function startDirector(
  model: RoundModel,
  scene: Presenter,
  sounds: RoundSounds,
  settings: Store<Settings>,
  now: () => number = () => performance.now(),
): () => void {
  /** Bumped on every phase change; an animation that finishes late checks it before reporting. */
  let generation = 0;
  let timings = currentTimings();
  let cocked: Promise<void> = Promise.resolve();
  let startedAt = now();
  let stepBefore = 0;

  function currentTimings(): Timings {
    const speed = allowedSpeed(settings.get().speed, model.state.jurisdiction.turboAllowed);
    return timingsFor(speed, scene.reducedMotion);
  }

  async function reveal(gen: number, flip: Flip): Promise<void> {
    await cocked;
    if (gen !== generation) return;
    scene.fire(timings.spinMs, timings.pace);
    // the cylinder only spins with full motion, so its sound does too
    sounds.shot(scene.reducedMotion ? null : timings.spinMs);
    await scene.flip(flip.outcome, timings.flipMs, timings.turns);
    if (gen !== generation) return;
    sounds.land();
    model.finishReveal();
  }

  async function show(gen: number, state: RoundState, outcome: Outcome, flip: Flip | null) {
    const { kind, level } = celebration(state, outcome, flip, stepBefore);
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
      case 'requesting':
        startedAt = now();
        stepBefore = state.openRun?.step ?? 0;
        timings = currentTimings();
        if (phase.pick) sounds.cock();
        cocked = phase.pick ? scene.cock(timings.cockMs) : Promise.resolve();
        break;
      case 'revealing':
        void reveal(gen, phase.flip);
        break;
      case 'result':
        void show(gen, state, phase.outcome, phase.flip);
        break;
      case 'error':
        scene.release();
        break;
      case 'idle':
        break;
    }
  });
  return () => {
    generation++;
    unsubscribe();
  };
}

/**
 * How big the result looks and how long it stays. `stepBefore` is the number
 * of correct picks in the run before this request.
 */
export function celebration(
  state: RoundState,
  outcome: Outcome,
  flip: Flip | null,
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
      if (!flip || state.mode === 'multiply')
        return { kind: 'cashout', level: Math.min(MAX_WIN_LEVEL, stepBefore + 1) };
      return { kind: 'win', level: betLevel(state) };
  }
}

/** Where the bet sits among the operator's levels, spread over 0 to 5 whatever their number. */
function betLevel(state: RoundState): number {
  const { bets } = state.config;
  const index = bets.indexOf(state.bet);
  if (bets.length < 2 || index < 0) return 0;
  return Math.round((index / (bets.length - 1)) * MAX_WIN_LEVEL);
}
