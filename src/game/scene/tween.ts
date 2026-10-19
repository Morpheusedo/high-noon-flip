/**
 * A small tween engine on the Pixi ticker.
 *
 * Tweens advance with the scene clock, so they pause with the ticker when the
 * tab is hidden and resume where they were. Every animation the director waits
 * for is built from these, which is why the round never runs ahead of what the
 * player sees.
 */

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut: (t: number) => 0.5 - Math.cos(Math.PI * t) / 2,
  /** Overshoots a little, then settles. */
  back: (t: number) => {
    const c = 1.9;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
} satisfies Record<string, Ease>;

/**
 * Time → progress of a movement that took `ms` and now takes `ms + slowMs`, all
 * the extra time in its last third: the first two thirds run as before, then it
 * slows from its old speed without a jolt and picks up a little to finish.
 */
export function slowLastThird(ms: number, slowMs: number): Ease {
  if (slowMs <= 0 || ms <= 0) return ease.linear;
  const cut = (2 / 3) * (ms / (ms + slowMs));
  // the entry slope that keeps the old speed (in the tail's own units), and the exit
  // slope; a cubic stays monotonic while both are at most 3
  const k = Math.min(3, 1 + (3 * slowMs) / ms);
  const m = 1;
  const tail = (u: number) => k * u + (3 - 2 * k - m) * u * u + (k + m - 2) * u * u * u;
  return (t) => (t < cut ? (t / cut) * (2 / 3) : 2 / 3 + tail((t - cut) / (1 - cut)) / 3);
}

type Numeric<T> = { [K in keyof T as T[K] extends number ? K : never]?: number };

interface Running {
  target: Record<string, number>;
  /** Values when the tween started; null while its delay runs. */
  from: Record<string, number> | null;
  to: Record<string, number>;
  ms: number;
  /** Negative while the delay runs. */
  t: number;
  ease: Ease;
  done: () => void;
  over: boolean;
}

export class Tweens {
  private running: Running[] = [];
  private timers: { at: number; done: () => void }[] = [];
  private now = 0;

  /**
   * Animates numeric fields of `target` to `to`; resolves when it gets there.
   *
   * When a tween starts (after its delay), any older tween of the same field
   * stops where it is and resolves, so two tweens never fight over a value.
   * Sequences are written with delays rather than chained promises for the
   * same reason: a chained step would start late and take over from a newer one.
   */
  to<T extends object>(
    target: T,
    to: Numeric<T>,
    ms: number,
    easing: Ease = ease.out,
    delayMs = 0,
  ): Promise<void> {
    return new Promise((done) => {
      const tw: Running = {
        target: target as Record<string, number>,
        from: null,
        to: to as Record<string, number>,
        ms: Math.max(1, ms),
        t: -delayMs,
        ease: easing,
        done,
        over: false,
      };
      // an older tween of these fields still waiting out its delay would undo this one
      for (const other of this.running)
        if (!other.from && this.overlaps(other, tw)) this.end(other);
      if (tw.t >= 0) this.start(tw);
      this.running.push(tw);
    });
  }

  /** Resolves after `ms` of scene time. */
  wait(ms: number): Promise<void> {
    return new Promise((done) => this.timers.push({ at: this.now + ms, done }));
  }

  update(dtMs: number): void {
    this.now += dtMs;
    for (const tw of [...this.running]) {
      if (tw.over) continue;
      tw.t += dtMs;
      if (tw.t < 0) continue;
      const from = tw.from ?? this.start(tw);
      const k = Math.min(1, tw.t / tw.ms);
      const e = tw.ease(k);
      for (const key in tw.to) {
        const a = from[key] ?? 0;
        tw.target[key] = a + ((tw.to[key] ?? a) - a) * e;
      }
      if (k >= 1) this.end(tw);
    }
    this.running = this.running.filter((tw) => !tw.over);
    const due = this.timers.filter((tm) => tm.at <= this.now);
    if (due.length) {
      this.timers = this.timers.filter((tm) => tm.at > this.now);
      for (const tm of due) tm.done();
    }
  }

  /** Ends everything at once (on a rebuild): every waiting promise resolves. */
  finishAll(): void {
    const running = this.running.splice(0);
    const timers = this.timers.splice(0);
    for (const tw of running) {
      if (tw.over) continue;
      Object.assign(tw.target, tw.to);
      this.end(tw);
    }
    for (const tm of timers) tm.done();
  }

  private start(tw: Running): Record<string, number> {
    for (const other of this.running)
      if (other !== tw && other.from && this.overlaps(other, tw)) this.end(other);
    const from: Record<string, number> = {};
    for (const key in tw.to) from[key] = tw.target[key] ?? 0;
    tw.from = from;
    return from;
  }

  private overlaps(a: Running, b: Running): boolean {
    return !a.over && a.target === b.target && Object.keys(b.to).some((key) => key in a.to);
  }

  private end(tw: Running): void {
    tw.over = true;
    tw.done();
  }
}
