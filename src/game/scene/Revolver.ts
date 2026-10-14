/**
 * The revolver standing on its grip, barrel up, under the coin.
 *
 * Cocking pulls the hammer back and turns the cylinder one chamber (the art has
 * a second frame for that). Firing drops the hammer, spins the engraved
 * cylinder surface three turns, kicks the gun down and to one side, and lets
 * smoke curl out of the muzzle.
 */
import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { SceneContext } from './context';
import type { Particles } from './particles';
import { ease } from './tween';

/** Warm grade over the photographed metal, to sit in the sunset light. */
const METAL_TINT = 0xf6dcc6;
/** Turns of the cylinder surface per shot. */
const SPIN_LAPS = 3;

/** A smoke puff; pairs are [base, random extra]. */
interface Puff {
  alpha: number;
  /** Width of the muzzle area it starts from, in units. */
  spread: number;
  size: [number, number];
  grow: [number, number];
  drift: number;
  rise: [number, number];
  life: [number, number];
}
/** The cloud of the shot itself. */
const BURST: Puff = {
  alpha: 0.34,
  spread: 3,
  size: [0.5, 0.4],
  grow: [2.4, 1.8],
  drift: 70,
  rise: [60, 130],
  life: [1300, 1300],
};
/** The wisps that keep curling out after it. */
const TRAIL: Puff = {
  alpha: 0.22,
  spread: 2,
  size: [0.4, 0],
  grow: [2.2, 1],
  drift: 50,
  rise: [70, 60],
  life: [1500, 0],
};

export class Revolver {
  readonly view = new Container();
  /** The muzzle, in stage units. */
  readonly muzzle: { x: number; y: number };

  private readonly base: Sprite;
  private readonly cocked: Sprite;
  private readonly spin = new Container();
  private readonly spinLeft: TilingSprite;
  private readonly spinRight: TilingSprite;
  private readonly streak: Sprite;
  private readonly hammer: Sprite;
  /** The hammer's pull, 0 at rest to 1 fully cocked; the setter squashes the sprite. */
  private readonly pull = { value: 0 };
  /** Cylinder spin progress, 0 to 1. */
  private readonly turn = { value: 0 };
  private readonly unit: number;

  constructor(
    private readonly ctx: SceneContext,
    private readonly smoke: Particles,
  ) {
    const { stage, layout, art, fx } = ctx;
    const r = layout.revolver;
    this.unit = stage.unit;
    this.muzzle = {
      x: stage.width * stage.revolver.x,
      y: stage.height * stage.revolver.top,
    };
    this.view.position.set(this.muzzle.x, this.muzzle.y);

    // the art is scaled so the barrel has the width the layout asks for
    const k = stage.revolver.barrelWidth / (art.revolver.base.width * r.barrelOfWidth);
    const picture = new Container();
    picture.scale.set(k, k * stage.revolver.squash);
    this.view.addChild(picture);

    this.base = new Sprite(art.revolver.base);
    this.base.anchor.set(0.5, 0);
    this.base.tint = METAL_TINT;
    this.cocked = new Sprite(art.revolver.cocked);
    this.cocked.anchor.set(0.5, 0);
    this.cocked.tint = METAL_TINT;
    this.cocked.visible = false;

    // the spinning cylinder: its surface scrolls across the two visible sides,
    // with the outer edges kept in shade so it still reads as round
    const sides = new Graphics()
      .poly(r.cylinderLeft)
      .fill(0xffffff)
      .poly(r.cylinderRight)
      .fill(0xffffff);
    const strip = (x: number) => {
      const t = new TilingSprite({
        texture: art.revolver.strip,
        width: r.spin.width,
        height: r.spin.height,
      });
      t.position.set(x, r.spin.top);
      t.tint = 0xffe6d2;
      t.tileScale.set(r.spin.tileScale);
      return t;
    };
    this.spinLeft = strip(r.spin.leftX);
    this.spinRight = strip(r.spin.rightX);
    const shade = (x: number) => {
      const s = new Sprite(fx.sheen);
      s.tint = 0x2a0f08;
      s.alpha = 0.3;
      s.width = 70;
      s.height = r.spin.height;
      s.position.set(x - 35, r.spin.top);
      return s;
    };
    this.spin.addChild(
      this.spinLeft,
      this.spinRight,
      shade(r.spin.leftX),
      shade(r.spin.rightX + r.spin.width),
    );
    this.spin.mask = sides;
    this.spin.alpha = 0;

    // a streak of light crosses the cylinder as it is cocked
    const c = r.cylinder;
    const cylinderBox = new Graphics()
      .roundRect(c.x, c.y, c.width, c.height, c.radius)
      .fill(0xffffff);
    this.streak = new Sprite(fx.sheen);
    this.streak.anchor.set(0.5);
    this.streak.width = 150;
    this.streak.height = 380;
    this.streak.position.set(r.streak.fromX, r.streak.y);
    this.streak.blendMode = 'add';
    this.streak.alpha = 0;
    this.streak.mask = cylinderBox;

    // the hammer is its own piece, hinged at its base: pulled back it sinks into its slot
    this.hammer = new Sprite(art.revolver.hammer);
    this.hammer.anchor.set(0.5, 1);
    this.hammer.position.set(r.hammerPivot.x, r.hammerPivot.y);
    this.hammer.tint = METAL_TINT;

    picture.addChild(
      this.base,
      this.cocked,
      this.spin,
      sides,
      cylinderBox,
      this.streak,
      this.hammer,
    );
  }

  /**
   * Pulls the hammer back and turns the cylinder a chamber. Takes `ms` in all
   * (230 at normal speed): the hammer moves in the first 130 of them.
   */
  async cock(ms: number): Promise<void> {
    const { tweens, motion, layout } = this.ctx;
    const k = ms / 230;
    if (!motion.reduced) {
      const { streak } = layout.revolver;
      this.streak.x = streak.fromX;
      this.streak.alpha = 0.42;
      void tweens.to(this.streak, { x: streak.toX }, 190 * k, ease.inOut);
      void tweens.to(this.streak, { alpha: 0 }, 1, ease.linear, 190 * k);
    }
    void tweens.wait(95 * k).then(() => this.swapFrame());
    await Promise.all([tweens.to(this.pull, { value: 1 }, 130 * k, ease.back), tweens.wait(ms)]);
  }

  /** Lets the hammer down without a shot, after a failed request. */
  release(): void {
    void this.ctx.tweens.to(this.pull, { value: 0 }, 120, ease.out);
  }

  /**
   * The shot. `spinMs` is how long the cylinder spins; `pace` stretches the
   * smoke that follows (1 at normal speed, smaller when faster).
   */
  fire(spinMs: number, pace: number): void {
    const { tweens, motion } = this.ctx;
    const u = this.unit;
    void tweens.to(this.pull, { value: 0 }, 50, ease.linear);

    if (!motion.reduced) {
      this.turn.value = 0.0001;
      void tweens.to(this.turn, { value: 1 }, spinMs, ease.out);
      this.swapFrame();
    }

    // recoil: down, then back with a little overshoot
    const restY = this.muzzle.y;
    void tweens.to(this.view, { y: restY + u * 4.6 }, 55, ease.out);
    void tweens.to(this.view, { y: restY }, 380, ease.back, 55);
    if (motion.reduced) return;

    // the muzzle kicks to one side and settles, and smoke keeps curling out for a moment
    const side = Math.random() < 0.5 ? -1 : 1;
    void tweens.to(this.view, { rotation: 0.028 * side }, 60, ease.out);
    void tweens.to(this.view, { rotation: 0 }, 420, ease.back, 60);
    for (let i = 0; i < 9; i++) this.puff(BURST);
    for (const ms of [220, 420, 640]) void tweens.wait(ms * pace).then(() => this.puff(TRAIL));
  }

  update(): void {
    this.setPull(this.pull.value);
    const r = this.ctx.layout.revolver.spin;
    const v = this.turn.value;
    const lap = r.period * r.tileScale * SPIN_LAPS;
    this.spinLeft.tilePosition.x = v * lap;
    this.spinRight.tilePosition.x = v * lap + r.rightPhase;
    this.spin.alpha = v <= 0 ? 0 : v < 0.8 ? 1 : Math.max(0, (1 - v) / 0.2);
  }

  private puff(p: Puff): void {
    if (this.view.destroyed) return;
    const r = Math.random;
    this.smoke.spawn(this.ctx.fx.soft, {
      x: this.muzzle.x + (r() - 0.5) * this.unit * p.spread,
      y: this.muzzle.y - this.unit,
      tint: 0xd8c7bd,
      a0: p.alpha,
      s0: p.size[0] + r() * p.size[1],
      s1: p.grow[0] + r() * p.grow[1],
      vx: (r() - 0.5) * p.drift,
      vy: -p.rise[0] - r() * p.rise[1],
      drag: 0.985,
      life: p.life[0] + r() * p.life[1],
    });
  }

  /** Shows the other frame: the cylinder one chamber on. */
  private swapFrame(): void {
    if (this.view.destroyed) return;
    this.cocked.visible = !this.cocked.visible;
    this.base.visible = !this.cocked.visible;
  }

  private setPull(value: number): void {
    const k = Math.max(0, Math.min(1.2, value));
    this.hammer.scale.set(1 + 0.06 * k, 1 - 0.17 * k);
    const c = 255 - 40 * k;
    this.hammer.tint =
      (Math.round(c * 0.965) << 16) | (Math.round(c * 0.863) << 8) | Math.round(c * 0.776);
  }
}
