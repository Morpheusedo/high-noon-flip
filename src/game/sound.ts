/**
 * High Noon Flip's sound design, on top of the shared `AudioManager`.
 *
 * Recorded sounds come from the sprite: the cylinder (tick, lock, spin) and
 * seventeen ricochets for a loss. The rest are the prototype's synthesized
 * placeholders until the sound designer delivers recordings; a recording added
 * to the sprite under the same name will replace its placeholder here.
 *
 * Music is two loops, calm and intense, blended by how much is at stake.
 */
import type { AudioManager } from '../shell/audio/AudioManager';
import { noise, tone, type Noise, type Tone } from '../shell/audio/synth';
import type { RoundModel, RoundState } from './model/RoundModel';

/** What the director plays during a round. */
export interface RoundSounds {
  /** The hammer goes back. */
  cock(): void;
  /** The shot; `spinMs` is how long the cylinder spins, or null when it does not. */
  shot(spinMs: number | null): void;
  /** The coin lands. */
  land(): void;
  win(): void;
  lose(): void;
}

/** What the interface plays. */
export interface UiSounds {
  click(): void;
  /** The bet steps one level, or the dial passes one chamber. */
  tick(): void;
  /** The dial comes to rest, a bet is chosen from the list, or a volume is set. */
  latch(): void;
  /** The bet dial was flicked across `levels` chambers. */
  spin(levels: number): void;
  /** The coin is turned over by hand. */
  coinTurn(): void;
}

const RICOCHETS = 17;

export class GameSounds implements RoundSounds, UiSounds {
  private lastRicochet = 0;

  constructor(private readonly audio: AudioManager) {}

  /* ---------- round ---------- */

  cock(): void {
    this.tone({ freq: 1400, dur: 0.03, type: 'square', gain: 0.1 });
    this.tone({ freq: 700, dur: 0.04, type: 'square', gain: 0.1, when: 0.07 });
  }

  shot(spinMs: number | null): void {
    this.noise({ dur: 0.4, gain: 0.95 });
    this.noise({ dur: 0.5, gain: 0.3, when: 0.16, cutoff: 900 });
    this.noise({ dur: 0.6, gain: 0.14, when: 0.36, cutoff: 600 });
    this.tone({ freq: 140, dur: 0.28, gain: 0.6, slideTo: 40 });
    // the ring of the barrel
    this.tone({ freq: 2640, dur: 1.1, gain: 0.11, when: 0.05 });
    this.tone({ freq: 3960, dur: 0.8, gain: 0.05, when: 0.05 });
    if (spinMs !== null) this.cylinder(spinMs / 1000 + 0.25);
  }

  land(): void {
    this.tone({ freq: 3100, dur: 0.35, gain: 0.1 });
    this.tone({ freq: 1900, dur: 0.08, type: 'triangle', gain: 0.1 });
  }

  win(): void {
    [523, 659, 784, 1047, 1319].forEach((freq, i) =>
      this.tone({ freq, dur: 0.24, type: 'triangle', gain: 0.2, when: i * 0.09 }),
    );
    for (let i = 0; i < 9; i++)
      this.tone({ freq: 2400 + Math.random() * 1800, dur: 0.12, gain: 0.05, when: 0.3 + i * 0.07 });
  }

  /** One of the recorded ricochets, at random, never the same one twice running. */
  lose(): void {
    const last = this.lastRicochet;
    let n = 1 + Math.floor(Math.random() * (last ? RICOCHETS - 1 : RICOCHETS));
    if (last && n >= last) n++;
    this.lastRicochet = n;
    if (this.audio.play(`rico-${String(n).padStart(2, '0')}`, { gain: 0.2 })) return;
    this.tone({ freq: 220, dur: 0.5, type: 'sawtooth', gain: 0.08, slideTo: 90 });
  }

  /* ---------- interface ---------- */

  click(): void {
    this.tone({ freq: 900, dur: 0.04, type: 'square', gain: 0.08 });
  }

  tick(): void {
    if (this.audio.play('tick', { gain: 0.55, rate: 0.94 + Math.random() * 0.14 })) return;
    this.noise({ dur: 0.028, gain: 0.5, cutoff: 7000 });
    this.tone({ freq: 3100, dur: 0.022, type: 'square', gain: 0.07 });
    this.tone({ freq: 1650, dur: 0.045, type: 'triangle', gain: 0.11, when: 0.006 });
  }

  latch(): void {
    if (this.audio.play('lock', { gain: 0.85 })) return;
    this.tone({ freq: 2100, dur: 0.025, type: 'square', gain: 0.12 });
    this.tone({ freq: 520, dur: 0.06, type: 'square', gain: 0.14, when: 0.045 });
    this.noise({ dur: 0.05, gain: 0.25, when: 0.045, cutoff: 3000 });
  }

  spin(levels: number): void {
    this.cylinder(0.3 + 0.12 * levels);
  }

  coinTurn(): void {
    this.tone({ freq: 2640, dur: 0.3, gain: 0.09 });
    this.tone({ freq: 3960, dur: 0.2, gain: 0.04 });
  }

  /* ---------- internals ---------- */

  /**
   * The recorded spin is 1.9 s and slows to its last clicks. Only its last
   * `seconds` play, so it always ends on those clicks; without the recording,
   * a few ticks that slow down.
   */
  private cylinder(seconds: number): void {
    const length = this.audio.clipLength('spin');
    const play = Math.min(length, Math.max(0.45, seconds));
    if (this.audio.play('spin', { gain: 0.8, offset: length - play, fadeIn: 0.05 })) return;
    for (let i = 1; i <= 5; i++) setTimeout(() => this.tick(), i * i * 14 * seconds);
  }

  private tone(t: Tone): void {
    const { ctx, sfx } = this.audio;
    if (ctx && sfx && this.audio.audible) tone(ctx, sfx, t);
  }

  private noise(n: Noise): void {
    const { ctx, sfx } = this.audio;
    if (ctx && sfx && this.audio.audible) noise(ctx, sfx, n);
  }
}

/* ---------- music ---------- */

/** How tense the moment is, 0 to 1: the stake among the operator's levels, raised by a multiply run. */
export function musicIntensity(s: RoundState): number {
  const { bets } = s.config;
  let i = bets.length > 1 ? Math.max(0, bets.indexOf(s.bet)) / (bets.length - 1) : 0;
  if (s.openRun) i += 0.12 + 0.13 * s.openRun.step;
  return Math.max(0, Math.min(1, i));
}

/**
 * Calm alone at low stakes, intense alone at high ones, crossfaded at equal
 * power in between. The lowest stakes are slightly muffled, as if heard from
 * outside the saloon.
 */
export function musicMix(intensity: number): {
  gains: { calm: number; hot: number };
  cutoffHz: number;
} {
  const x = Math.max(0, Math.min(1, (intensity - 0.3) / 0.4));
  const blend = x * x * (3 - 2 * x);
  return {
    gains: {
      calm: Math.cos((blend * Math.PI) / 2),
      hot: Math.sin((blend * Math.PI) / 2) * (0.8 + 0.2 * intensity),
    },
    cutoffHz: 2600 + 15000 * Math.min(1, intensity * 1.6),
  };
}

/** Keeps the music in step with the round; returns a function that stops it. */
export function startMusicDirector(model: RoundModel, audio: AudioManager): () => void {
  let last = -1;
  const update = (state: RoundState, glide: number) => {
    const intensity = musicIntensity(state);
    if (intensity === last) return;
    last = intensity;
    const mix = musicMix(intensity);
    audio.setMusicLayers(mix.gains, mix.cutoffHz, glide);
  };
  update(model.state, 0.25);
  return model.store.subscribe((state) => update(state, 0.9));
}
