/**
 * The desert behind everything: the photo for the current orientation, softly
 * blurred so the coin and the revolver stand out, a warm shade over the sun,
 * drifting dust and a slight parallax that follows the mouse.
 */
import { BlurFilter, Container, Sprite } from 'pixi.js';
import type { SceneContext } from './context';

interface Mote {
  sprite: Sprite;
  x: number;
  y: number;
  speed: number;
  phase: number;
}

const DUST_COUNT = 30;
/** Share of the overscan margin the parallax may use, so the edges never show. */
const PARALLAX_REACH = 0.6;
const DUST_DEPTH = 20;

export class Background {
  /** Photo and dust; goes at the back. */
  readonly view = new Container();
  /** Dark corners; the scene puts them above everything but the white flash. */
  readonly vignette: Sprite;

  private readonly plate = new Container();
  private readonly dust = new Container();
  private readonly motes: Mote[] = [];
  private readonly width: number;
  private readonly height: number;
  private readonly parallaxReach: number;
  private parallax = 0;

  constructor(private readonly ctx: SceneContext) {
    const { stage, layout, art, fx } = ctx;
    const { width: W, height: H } = stage;
    this.width = W;
    this.height = H;
    const portrait = H > W;

    // the photo, drawn oversize so its blurred edges stay off screen
    const photo = new Sprite(portrait ? art.background.portrait : art.background.landscape);
    photo.anchor.set(0.5);
    photo.scale.set(
      Math.max(W / photo.texture.width, H / photo.texture.height) * layout.background.overscan,
    );
    photo.position.set(W / 2, H / 2);
    const blur = new BlurFilter({ strength: layout.background.blur, quality: 3 });
    blur.repeatEdgePixels = true;
    photo.filters = [blur];

    // take the glare off the sun: a warm shade centred on it, fading out into the sky
    const { sun } = stage.background;
    const shade = new Sprite(fx.soft);
    shade.anchor.set(0.5);
    shade.position.set(W * sun.x, H * sun.y);
    shade.width = shade.height = sun.size;
    shade.tint = 0x8a3c16;
    shade.alpha = 0.42;

    this.plate.addChild(photo, shade);
    this.parallaxReach = ((layout.background.overscan - 1) / 2) * W * PARALLAX_REACH;

    for (let i = 0; i < (ctx.motion.reduced ? 0 : DUST_COUNT); i++) {
      const sprite = new Sprite(fx.soft);
      sprite.anchor.set(0.5);
      sprite.tint = 0xffd9a0;
      sprite.blendMode = 'add';
      sprite.scale.set(0.03 + Math.random() * 0.09);
      this.dust.addChild(sprite);
      this.motes.push({
        sprite,
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 6 + Math.random() * 18,
        phase: Math.random() * 6,
      });
    }

    this.vignette = new Sprite(fx.vignette);
    this.vignette.width = W;
    this.vignette.height = H;
    this.vignette.alpha = 0.5;

    this.view.addChild(this.plate, this.dust);
  }

  /**
   * Paints the blurred photo into one texture at the size it is shown, so the
   * blur runs once per resize rather than on every frame.
   */
  bake(pixelsPerUnit: number): void {
    this.plate.cacheAsTexture(false);
    this.plate.cacheAsTexture({ resolution: Math.min(2, Math.max(0.25, pixelsPerUnit)) });
  }

  /** Pointer position across the stage, -1 (left) to 1 (right). */
  pointAt(x: number): void {
    this.parallax = this.ctx.motion.reduced ? 0 : -x;
  }

  update(dtMs: number, timeMs: number): void {
    const s = dtMs / 1000;
    const shift = this.plate.x + (this.parallax * this.parallaxReach - this.plate.x) * 0.06;
    this.plate.x = shift;
    this.dust.x = (shift / (this.parallaxReach || 1)) * DUST_DEPTH;

    for (const m of this.motes) {
      m.x += m.speed * s;
      m.y -= m.speed * 0.25 * s + Math.sin(timeMs / 900 + m.phase) * 0.05;
      if (m.x > this.width + 20) m.x = -20;
      if (m.y < -20) m.y = this.height + 20;
      m.sprite.position.set(m.x, m.y);
      m.sprite.alpha = 0.18 + 0.16 * Math.sin(timeMs / 700 + m.phase);
    }
  }
}
