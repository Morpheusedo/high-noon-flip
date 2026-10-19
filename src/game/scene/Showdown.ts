/**
 * The showdown on the high rungs (see `game/tension.ts`): the light closes in
 * on the coin and, on the last rungs, the camera pushes in on it.
 *
 * Both are a transform and an alpha: a pre-drawn spotlight sprite and the scale
 * of the container that holds the scene, never a live filter, which a low-end
 * Android phone could not afford every frame.
 */
import { Sprite, type Container } from 'pixi.js';
import type { Tension } from '../tension';
import type { SceneContext } from './context';
import { SPOTLIGHT } from './textures';
import { ease } from './tween';

/**
 * The clear disc around the middle of the coin's flight, in coin radii: the coin
 * and its hop fit in it; the dark is full at twice that (`SPOTLIGHT`).
 */
const CLEAR_RADII = 1.25;

export class Showdown {
  /** Darkens everything but the coin; goes in the camera, just under the coin. */
  readonly shade: Sprite;

  constructor(
    private readonly ctx: SceneContext,
    /** The container the camera moves: the scene without its overlays. */
    private readonly camera: Container,
  ) {
    const { stage } = ctx;
    const r = stage.coin.radius;
    const hop = r * stage.coin.hop;
    const x = stage.width * stage.coin.x;
    const restY = stage.height * stage.coin.y;

    this.shade = new Sprite(ctx.fx.spotlight);
    this.shade.anchor.set(0.5);
    // centred on the middle of the flight; the texture's dark edge reaches past the
    // stage from any point on it
    this.shade.position.set(x, restY - hop / 2);
    this.shade.width = this.shade.height = ((2 * CLEAR_RADII) / SPOTLIGHT.inner) * r;
    this.shade.alpha = 0;

    // the camera pushes in toward the top of the coin's flight, so the coin never
    // rises further toward the ladder than it does now; the rest moves down and out
    const focus = { x, y: restY - hop - r };
    camera.pivot.set(focus.x, focus.y);
    camera.position.set(focus.x, focus.y);
    camera.scale.set(1);
  }

  /** The light closes in, and the camera pushes in if `t` says so. */
  closeIn(t: Tension): void {
    const { tweens } = this.ctx;
    void tweens.to(this.shade, { alpha: 1 - t.light }, t.inMs, ease.out);
    if (t.zoom !== 1)
      void tweens.to(this.camera.scale, { x: t.zoom, y: t.zoom }, t.zoomMs, ease.inOut);
  }

  /** Back to the plain scene over `ms`. */
  open(ms: number): void {
    const { tweens } = this.ctx;
    void tweens.to(this.shade, { alpha: 0 }, ms, ease.inOut);
    void tweens.to(this.camera.scale, { x: 1, y: 1 }, ms, ease.inOut);
  }

  /** Where `t` ends up, at once: for a scene rebuilt (a rotation) in the middle of it. */
  hold(t: Tension): void {
    this.shade.alpha = 1 - t.light;
    this.camera.scale.set(t.zoom);
  }
}
