/**
 * Short-lived sprites that fly, fall, grow and fade: smoke, sparks, win coins.
 */
import { Sprite, type Container, type Texture } from 'pixi.js';

export interface ParticleSpec {
  x: number;
  y: number;
  tint?: number;
  /** Additive blending, for light. */
  add?: boolean;
  /** Scale at birth and at death. */
  s0: number;
  s1?: number;
  a0?: number;
  vx?: number;
  vy?: number;
  /** Gravity, stage units per second squared. */
  gravity?: number;
  /** Velocity kept per 60 fps frame: 0.97 slows down quickly, 1 not at all. */
  drag?: number;
  life: number;
  /** Share of the life spent at full alpha before fading. */
  hold?: number;
  /** Turns about the vertical axis, radians per second: a coin spinning as it falls. */
  flip?: number;
}

interface Particle {
  sprite: Sprite;
  age: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  s0: number;
  s1: number;
  a0: number;
  hold: number;
  flip: number;
}

export class Particles {
  private readonly live: Particle[] = [];

  constructor(private readonly layer: Container) {}

  spawn(texture: Texture, spec: ParticleSpec): void {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(spec.x, spec.y);
    sprite.tint = spec.tint ?? 0xffffff;
    if (spec.add) sprite.blendMode = 'add';
    sprite.scale.set(spec.s0);
    sprite.alpha = spec.a0 ?? 1;
    this.layer.addChild(sprite);
    this.live.push({
      sprite,
      age: 0,
      vx: spec.vx ?? 0,
      vy: spec.vy ?? 0,
      gravity: spec.gravity ?? 0,
      drag: spec.drag ?? 1,
      life: spec.life,
      s0: spec.s0,
      s1: spec.s1 ?? spec.s0,
      a0: spec.a0 ?? 1,
      hold: spec.hold ?? 0,
      flip: spec.flip ?? 0,
    });
  }

  update(dtMs: number): void {
    const s = dtMs / 1000;
    const drag = dtMs / 16.7;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      if (!p) continue;
      p.age += dtMs;
      const k = p.age / p.life;
      if (k >= 1) {
        p.sprite.destroy();
        this.live.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * s;
      p.vx *= Math.pow(p.drag, drag);
      p.vy *= Math.pow(p.drag, drag);
      p.sprite.x += p.vx * s;
      p.sprite.y += p.vy * s;
      const size = p.s0 + (p.s1 - p.s0) * k;
      p.sprite.scale.set(p.flip ? size * Math.cos((p.age / 1000) * p.flip) : size, size);
      p.sprite.alpha = p.a0 * (p.hold ? Math.min(1, (1 - k) / (1 - p.hold)) : 1 - k);
    }
  }
}
