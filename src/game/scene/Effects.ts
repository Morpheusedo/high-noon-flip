/**
 * Light and motion around the round: the muzzle flash and its sparks, the rays
 * and coin shower of a win, the dimming of a loss, and the screen shake.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import type { SceneContext } from './context';
import { Particles } from './particles';
import { ease } from './tween';

export class Effects {
  /** Win rays; go behind the coin. */
  readonly back = new Container();
  /** Flash, sparks and coins; go in front of the coin. */
  readonly front = new Container();
  /** Darkens the scene on a loss; goes above the front layer. */
  readonly dim: Graphics;
  /** A brief white-out on the shot; goes on top of everything. */
  readonly white: Graphics;

  private readonly particles = new Particles(this.front);
  private readonly rays: Sprite;
  private readonly flash: Sprite;
  private readonly flashGlow: Sprite;
  private readonly muzzleAt: { x: number; y: number };
  private readonly coinAt: { x: number; y: number };
  private readonly radius: number;
  private shake = 0;

  constructor(private readonly ctx: SceneContext) {
    const { stage, fx } = ctx;
    const { width: W, height: H, unit } = stage;
    const r = stage.coin.radius;
    this.radius = r;
    this.coinAt = { x: W * stage.coin.x, y: H * stage.coin.y };
    this.muzzleAt = { x: W * stage.revolver.x, y: H * stage.revolver.top };

    this.rays = new Sprite(fx.rays);
    this.rays.anchor.set(0.5);
    this.rays.position.set(this.coinAt.x, this.coinAt.y);
    this.rays.width = this.rays.height = r * 6;
    this.rays.tint = 0xffd66b;
    this.rays.blendMode = 'add';
    this.rays.alpha = 0;
    this.back.addChild(this.rays);

    this.flash = new Sprite(fx.flash);
    this.flash.anchor.set(0.5);
    this.flash.position.set(this.muzzleAt.x, this.muzzleAt.y - unit * 2);
    this.flash.blendMode = 'add';
    this.flash.alpha = 0;

    this.flashGlow = new Sprite(fx.soft);
    this.flashGlow.anchor.set(0.5);
    this.flashGlow.position.set(this.muzzleAt.x, this.muzzleAt.y);
    this.flashGlow.width = this.flashGlow.height = r * 6;
    this.flashGlow.tint = 0xffd27a;
    this.flashGlow.blendMode = 'add';
    this.flashGlow.alpha = 0;
    this.front.addChild(this.flash, this.flashGlow);

    const cover = (color: number) => {
      const g = new Graphics().rect(-100, -100, W + 200, H + 200).fill(color);
      g.alpha = 0;
      return g;
    };
    this.dim = cover(0x0a0408);
    this.white = cover(0xfff3d6);
  }

  /** The flash and sparks of the shot. */
  muzzle(): void {
    const { tweens, motion, fx } = this.ctx;
    const k = this.radius / 160;
    this.flash.alpha = 1;
    this.flash.scale.set(k * 0.5);
    this.flash.rotation = Math.random() * 3;
    void tweens.to(this.flash, { alpha: 0 }, 170, ease.linear);
    void tweens.to(this.flash.scale, { x: k * 1.7, y: k * 1.7 }, 170, ease.out);
    this.flashGlow.alpha = 0.95;
    void tweens.to(this.flashGlow, { alpha: 0 }, 380, ease.out);
    if (motion.reduced) return;

    this.white.alpha = 0.22;
    void tweens.to(this.white, { alpha: 0 }, 220, ease.out);
    this.shake = 26;
    const { x, y } = this.muzzleAt;
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 260 + Math.random() * 620;
      this.particles.spawn(fx.soft, {
        x,
        y,
        add: true,
        tint: i % 3 ? 0xffc65a : 0xfff3c4,
        s0: 0.1 + Math.random() * 0.1,
        s1: 0.02,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        gravity: 900,
        drag: 0.97,
        life: 380 + Math.random() * 420,
      });
    }
  }

  /** Rays behind the coin and a shower of coins; `level` 0 to 5 makes it bigger. */
  win(level: number): void {
    const { tweens, motion, fx } = this.ctx;
    this.rays.alpha = 0;
    void tweens.to(this.rays, { alpha: 0.75 }, 250, ease.out);
    void tweens.to(this.rays, { alpha: 0 }, 1300, ease.linear, 550);
    if (motion.reduced) return;

    const { x, y } = this.coinAt;
    const r = this.radius;
    const k = r / 162;
    const count = 26 + level * 16;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const v = (620 + Math.random() * 760) * k;
      const size = (0.34 + Math.random() * 0.3) * k;
      this.particles.spawn(fx.miniCoin, {
        x: x + (Math.random() - 0.5) * r,
        y,
        s0: size,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        gravity: 1700 * k,
        life: 1500 + Math.random() * 700,
        hold: 0.8,
        flip: 9 + Math.random() * 9,
      });
    }
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 120 + Math.random() * 520;
      this.particles.spawn(fx.soft, {
        x,
        y,
        add: true,
        tint: 0xfff0b0,
        s0: 0.16,
        s1: 0.02,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 0.95,
        life: 600 + Math.random() * 500,
      });
    }
    this.shake = 8 + level * 3;
  }

  /** The scene darkens for a moment. */
  lose(): void {
    const { tweens } = this.ctx;
    void tweens.to(this.dim, { alpha: 0.38 }, 200, ease.out);
    void tweens.to(this.dim, { alpha: 0 }, 700, ease.inOut, 700);
  }

  /** Advances particles and the shake; returns how far to jolt the scene this frame. */
  update(dtMs: number): { x: number; y: number } {
    this.particles.update(dtMs);
    if (this.rays.alpha > 0) this.rays.rotation += (dtMs / 1000) * 0.5;
    this.shake *= Math.pow(0.84, dtMs / 16.7);
    if (this.shake < 0.05) this.shake = 0;
    return {
      x: (Math.random() - 0.5) * this.shake,
      y: (Math.random() - 0.5) * this.shake,
    };
  }
}
