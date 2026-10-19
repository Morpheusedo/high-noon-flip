/**
 * The coin, seen face-on and turning about its horizontal axis.
 *
 * At rest it bobs and tips as if about to flip, but always settles back on the
 * same face. A shot sends it up, spinning, to land on the face the server
 * chose. The player may also turn it over by hand; that is for looks only.
 */
import { BlurFilter, Container, Graphics, Sprite } from 'pixi.js';
import type { Side } from '../../server/protocol';
import type { SceneContext } from './context';
import { ease, type Ease } from './tween';

/** Which face is up, kept across rebuilds so turning the device does not flip the coin. */
export interface CoinPose {
  /** Degrees; 0 (mod 360) shows the sheriff, 180 the outlaw. */
  angle: number;
}

interface Flight {
  t: number;
  from: number;
  to: number;
  /** Peak height, in stage units. */
  hop: number;
}

interface Turn {
  t: number;
  from: number;
}

const TURN_MS = 340;
const GLINT_EVERY_MS = 2800;

export class Coin {
  readonly view = new Container();
  /** Warm light around the coin; goes just behind it. */
  readonly glow: Sprite;
  /** The coin's shadow on the muzzle; goes just behind the glow. */
  readonly shadow: Sprite;

  private readonly face: Sprite;
  private readonly edge = new Graphics();
  private readonly mask: Graphics;
  private readonly spec: Sprite;
  private readonly sheen: Sprite;
  private readonly blur = new BlurFilter({ strengthX: 0, strengthY: 0 });
  private readonly faceScale: number;
  private readonly radius: number;
  private readonly restY: number;
  private readonly shadowWidth: number;
  private flight: Flight | null = null;
  private turning: Turn | null = null;
  private glintAt = 1500;
  private time = 0;

  constructor(
    private readonly ctx: SceneContext,
    private readonly pose: CoinPose,
  ) {
    const { stage, layout, art, fx } = ctx;
    const r = stage.coin.radius;
    this.radius = r;
    this.restY = stage.height * stage.coin.y;
    const x = stage.width * stage.coin.x;
    this.view.position.set(x, this.restY);

    this.shadow = new Sprite(fx.soft);
    this.shadow.anchor.set(0.5);
    this.shadow.position.set(
      stage.width * stage.revolver.x,
      stage.height * stage.revolver.top + stage.unit * 1.2,
    );
    this.shadow.tint = 0x120604;
    this.shadowWidth = stage.revolver.barrelWidth * 1.7;

    this.glow = new Sprite(fx.soft);
    this.glow.anchor.set(0.5);
    this.glow.position.set(x, this.restY);
    this.glow.width = this.glow.height = r * 3.6;
    this.glow.tint = 0xffc24d;
    this.glow.blendMode = 'add';

    this.face = new Sprite(art.coin.sheriff);
    this.face.anchor.set(0.5);
    this.face.width = this.face.height = r * 2;
    this.faceScale = this.face.scale.x;

    this.mask = new Graphics().circle(0, 0, r * layout.coin.faceInset).fill(0xffffff);

    // a soft band of reflected light that slides over the face as it tilts
    this.spec = new Sprite(fx.soft);
    this.spec.anchor.set(0.5);
    this.spec.width = r * 2.6;
    this.spec.height = r;
    this.spec.tint = 0xfff0cc;
    this.spec.blendMode = 'add';
    this.spec.alpha = 0;
    this.spec.mask = this.mask;

    // the glint that crosses the face every few seconds at rest
    this.sheen = new Sprite(fx.sheen);
    this.sheen.anchor.set(0.5);
    this.sheen.width = r * 0.55;
    this.sheen.height = r * 3;
    this.sheen.rotation = 0.42;
    this.sheen.blendMode = 'add';
    this.sheen.x = -r * 2;
    this.sheen.mask = this.mask;

    this.view.addChild(this.edge, this.face, this.mask, this.spec, this.sheen);
    this.draw(pose.angle, false);
  }

  /**
   * Sends the coin up to land on `side`; resolves when it lands. `timing` maps
   * time to the flight's progress: steady, or slowed at the end for a showdown.
   */
  async flipTo(side: Side, ms: number, turns: number, timing: Ease = ease.linear): Promise<void> {
    const { tweens, motion } = this.ctx;
    // a turn by hand still under way is cut short where it is
    const from = this.turning ? turnAngle(this.turning) : this.pose.angle;
    this.turning = null;
    const to = Math.ceil(from / 360) * 360 + turns * 360 + (side === 'outlaw' ? 180 : 0);
    const flight: Flight = {
      t: 0,
      from,
      to,
      hop: motion.reduced ? 0 : this.radius * this.ctx.stage.coin.hop,
    };
    this.flight = flight;
    if (!motion.reduced) this.view.filters = [this.blur];

    await tweens.to(flight, { t: 1 }, ms, timing);
    this.pose.angle = to;
    if (this.view.destroyed) return;
    this.flight = null;
    this.view.filters = [];
    this.view.scale.set(1);
    this.view.y = this.restY;
    this.glintAt = this.time + 250;
  }

  /** Turns the coin to its other face, for looks; returns the face that will be up, or null if busy. */
  turnOver(): Side | null {
    if (this.flight || this.turning) return null;
    const from = Math.round(this.pose.angle / 180) * 180;
    const turn: Turn = { t: 0, from };
    this.turning = turn;
    void this.ctx.tweens
      .to(turn, { t: 1 }, this.ctx.motion.reduced ? 1 : TURN_MS, ease.linear)
      .then(() => {
        if (this.turning !== turn) return;
        this.pose.angle = from + 180;
        this.turning = null;
        this.glintAt = this.time + 150;
      });
    return faceAt(from + 180);
  }

  update(timeMs: number): void {
    this.time = timeMs;
    const reduced = this.ctx.motion.reduced;
    const r = this.radius;
    const flight = this.flight;

    if (flight) {
      const t = flight.t;
      const before = this.pose.angle;
      this.pose.angle = flight.from + (flight.to - flight.from) * (1 - Math.pow(1 - t, 2.4));
      // up and down, with a small dip below rest as it lands
      const up =
        t < 0.86 ? Math.sin((Math.PI * t) / 0.86) : -0.07 * Math.sin((Math.PI * (t - 0.86)) / 0.14);
      this.view.y = this.restY - flight.hop * up;
      this.view.scale.set(1 + 0.05 * Math.max(0, up));
      this.blur.strengthY = reduced ? 0 : Math.min(9, Math.abs(this.pose.angle - before) * 0.22);
      this.draw(this.pose.angle, true);
    } else {
      // idle tease: rides up and down and tips, but always settles on the same face
      const phase = timeMs / 950;
      let bob = reduced ? 0 : -Math.sin(phase) * r * 0.1;
      let angle = this.pose.angle;
      const turn = this.turning;
      if (turn) {
        angle = turnAngle(turn);
        bob -= Math.sin(Math.PI * turn.t) * r * 0.16;
      }
      this.view.y = this.restY + bob;
      this.draw(angle + (reduced || turn ? 0 : Math.sin(phase) * 14), !!turn);
      if (timeMs > this.glintAt) {
        this.glintAt = timeMs + GLINT_EVERY_MS;
        this.sheen.x = -r * 1.5;
        void this.ctx.tweens.to(this.sheen, { x: r * 1.5 }, 750, ease.inOut);
      }
    }

    // glow follows the coin; the shadow spreads and fades as it rises
    const rise = (this.restY - this.view.y) / r;
    this.glow.y = this.view.y;
    this.glow.alpha = 0.36 + Math.sin(timeMs / 800) * 0.06;
    const spread = Math.max(0.7, 1 + rise * 1.6);
    this.shadow.width = this.shadowWidth * spread;
    this.shadow.height = this.shadowWidth * 0.5 * spread;
    this.shadow.alpha = Math.max(0, 0.42 - rise * 0.9);
  }

  /** Draws the coin tilted to `deg`; `spinning` drops the details that would flicker. */
  private draw(deg: number, spinning: boolean): void {
    const { art } = this.ctx;
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const r = this.radius;
    const k = Math.max(Math.abs(c), 0.02);
    this.face.texture = c >= 0 ? art.coin.sheriff : art.coin.outlaw;
    this.face.scale.set(this.faceScale, this.faceScale * k);

    // light comes from the sky above and in front: leaning back the face catches it,
    // leaning forward it falls into shade; e runs smoothly from 0 (shaded) to 1 (lit)
    const lit = c >= 0 ? s : -s;
    const u = Math.max(0, Math.min(1, (lit + 0.242) / 0.484));
    const e = u * u * (3 - 2 * u);
    const L = 0.86 + 0.07 * e;
    this.face.tint =
      (Math.round(255 * L) << 16) |
      (Math.round(255 * Math.pow(L, 1.05)) << 8) |
      Math.round(255 * Math.pow(L, 1.12));
    this.mask.scale.y = k;
    this.spec.y = -lit * r * 0.62 * k;
    this.spec.height = r * (0.5 + 0.5 * k);
    this.spec.alpha = (0.06 + 0.26 * e) * (spinning ? 0.6 : 1);
    this.sheen.alpha = 0.5 * e;
    this.sheen.visible = !spinning;

    // the rim: bright where it faces the sky, dark where it faces the ground
    const off = r * 0.085 * s;
    const mix = (from: number, to: number) => Math.round(from + (to - from) * e);
    const rim = (mix(0xa4, 0xc6) << 16) | (mix(0x6c, 0x8a) << 8) | mix(0x34, 0x46);
    this.edge
      .clear()
      .ellipse(0, off, r, r * k)
      .rect(-r, Math.min(0, off), r * 2, Math.abs(off))
      .fill(rim)
      .rect(-r * 0.55, Math.min(0, off), r * 0.3, Math.abs(off))
      .fill({ color: 0xf2bc86, alpha: 0.35 + 0.2 * e });
  }
}

function faceAt(deg: number): Side {
  return Math.round(deg / 180) % 2 === 0 ? 'sheriff' : 'outlaw';
}

function turnAngle(turn: Turn): number {
  return turn.from + 180 * (1 - Math.pow(1 - turn.t, 3));
}
