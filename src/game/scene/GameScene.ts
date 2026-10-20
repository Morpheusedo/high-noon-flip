/**
 * The Pixi side of the game: everything painted on the canvas.
 *
 * The scene works in design units: a 1600 x 900 stage, or 900 x 1600 on tall
 * screens (see `scene-layout.json`), scaled to the canvas. Turning the device
 * rebuilds every part for the other orientation.
 *
 * The director drives it through the public methods below; each one that takes
 * time returns a promise that resolves when the animation is over.
 */
import { Application, Container } from 'pixi.js';
import type { Side } from '../../server/protocol';
import type { Presenter } from '../director';
import type { Tension } from '../tension';
import { Background } from './Background';
import { Coin, type CoinPose } from './Coin';
import type { CoinFaces } from './coinArt';
import { Effects } from './Effects';
import { loadArt, type ArtTextures, type Motion, type SceneContext } from './context';
import { loadLayout, type Orientation, type SceneLayout } from './layout';
import { Particles } from './particles';
import { Revolver } from './Revolver';
import { Showdown } from './Showdown';
import type { FxTextures } from './textures';
import { slowLastThird, Tweens } from './tween';

/** Longest frame step the animations take, so a stall does not make things jump. */
const MAX_STEP_MS = 50;

/** Everything built for one orientation; thrown away when it changes. */
interface Parts {
  orientation: Orientation;
  background: Background;
  revolver: Revolver;
  coin: Coin;
  effects: Effects;
  showdown: Showdown;
  /** Smoke: behind the revolver. */
  smoke: Particles;
}

export class GameScene implements Presenter {
  private readonly app = new Application();
  private readonly root = new Container();
  private readonly tweens = new Tweens();
  private readonly reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly motion: Motion = motionOf(this.reducedQuery);
  private layout: SceneLayout | null = null;
  private assets: { art: ArtTextures; fx: FxTextures } | null = null;
  private parts: Parts | null = null;
  private readonly coinPose: CoinPose = { angle: 0 };
  /** The showdown under way, kept so a rebuild mid-flip can put it back; null when calm. */
  private tense: Tension | null = null;
  private time = 0;

  /**
   * Loads the art and starts drawing into `host`, with the coin's faces from `coin`;
   * `onProgress` gets 0..1 while the art loads.
   */
  async mount(
    host: HTMLElement,
    coin: Promise<CoinFaces>,
    onProgress?: (fraction: number) => void,
  ): Promise<void> {
    const [layout] = await Promise.all([
      loadLayout(),
      this.app.init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      }),
    ]);
    this.layout = layout;
    this.assets = await loadArt(layout, coin, onProgress);
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.root);

    this.app.renderer.on('resize', () => this.fit());
    this.reducedQuery.addEventListener('change', () => {
      this.build();
      this.fit();
    });
    this.listenForParallax(host.parentElement ?? host);
    this.app.ticker.add((ticker) => this.update(Math.min(ticker.deltaMS, MAX_STEP_MS)));
    this.fit();
  }

  /* ---------- what the director calls ---------- */

  get reducedMotion(): boolean {
    return this.motion.reduced;
  }

  /** Hammer back, cylinder a chamber on. */
  cock(ms: number): Promise<void> {
    return this.parts?.revolver.cock(ms) ?? Promise.resolve();
  }

  /** Lets the hammer down without a shot. */
  release(): void {
    this.parts?.revolver.release();
  }

  /** The shot; `pace` is the speed's time factor (1 at normal speed). */
  fire(spinMs: number, pace: number): void {
    this.parts?.revolver.fire(spinMs, pace);
    this.parts?.effects.muzzle();
  }

  /**
   * Flies the coin to land on `side`; resolves when it lands, after `ms` plus
   * `slowMs`, the slow motion of a showdown, spent in the flight's last third.
   */
  flip(side: Side, ms: number, turns: number, slowMs = 0): Promise<void> {
    return (
      this.parts?.coin.flipTo(side, ms + slowMs, turns, slowLastThird(ms, slowMs)) ??
      Promise.resolve()
    );
  }

  /** The light closes in on the coin, and on the last rungs the camera pushes in. */
  tension(t: Tension): void {
    this.tense = t;
    this.parts?.showdown.closeIn(t);
  }

  /** Back to the plain scene over `ms`. */
  calm(ms: number): void {
    this.tense = null;
    this.parts?.showdown.open(ms);
  }

  /** Puts on another skin's faces; the coin shows them from the next frame, even mid-flip. */
  setCoin(faces: CoinFaces): void {
    if (this.assets) this.assets.art.coin = faces;
  }

  /** Turns the coin over by hand, for looks; returns the face now up, or null while it is busy. */
  turnCoin(): Side | null {
    return this.parts?.coin.turnOver() ?? null;
  }

  /** Rays and a coin shower; `level` 0 to 5 sets how big. */
  win(level: number): void {
    this.parts?.effects.win(level);
  }

  lose(): void {
    this.parts?.effects.lose();
  }

  /**
   * Resolves after `ms` of scene time: pauses with the scene when the tab is hidden,
   * and runs its full time through a rotation or resize, which rebuilds the scene.
   */
  wait(ms: number): Promise<void> {
    return this.tweens.wait(ms, true);
  }

  /* ---------- building ---------- */

  private build(): void {
    const { layout, assets } = this;
    if (!layout || !assets) return;
    const { width, height } = this.app.screen;
    const orientation: Orientation = height > width ? 'portrait' : 'landscape';

    // settle every running animation so nothing waits on a part that is about to go
    this.tweens.finishAll();
    for (const child of this.root.removeChildren()) child.destroy({ children: true });

    const ctx: SceneContext = {
      stage: layout[orientation],
      layout,
      art: assets.art,
      fx: assets.fx,
      tweens: this.tweens,
      motion: this.motion,
    };
    const background = new Background(ctx);
    const smokeLayer = new Container();
    const smoke = new Particles(smokeLayer);
    const revolver = new Revolver(ctx, smoke);
    const coin = new Coin(ctx, this.coinPose);
    const effects = new Effects(ctx);
    // the camera holds the scene; the overlays stay outside it, on the whole screen
    const camera = new Container();
    const showdown = new Showdown(ctx, camera);
    if (this.tense) showdown.hold(this.tense);
    camera.addChild(
      background.view,
      effects.back,
      smokeLayer,
      revolver.view,
      showdown.shade,
      coin.shadow,
      coin.glow,
      coin.view,
      effects.front,
    );
    this.root.addChild(camera, effects.dim, background.vignette, effects.white);
    this.parts = { orientation, background, revolver, coin, effects, showdown, smoke };
  }

  /** Fits the design stage to the canvas; rebuilds when the orientation flips. */
  private fit(): void {
    const { width, height } = this.app.screen;
    if (!width || !height) return;
    const orientation: Orientation = height > width ? 'portrait' : 'landscape';
    if (this.parts?.orientation !== orientation) this.build();
    const parts = this.parts;
    if (!parts || !this.layout) return;
    const stage = this.layout[orientation];
    const scale = Math.min(width / stage.width, height / stage.height);
    this.root.scale.set(scale);
    parts.background.bake(scale * this.app.renderer.resolution);
  }

  /* ---------- every frame ---------- */

  private update(dtMs: number): void {
    const parts = this.parts;
    if (!parts) return;
    this.time += dtMs;
    this.tweens.update(dtMs);
    parts.background.update(dtMs, this.time);
    parts.revolver.update();
    parts.coin.update(this.time);
    parts.smoke.update(dtMs);
    const jolt = parts.effects.update(dtMs);
    this.root.position.set(jolt.x * this.root.scale.x, jolt.y * this.root.scale.y);
  }

  private listenForParallax(target: HTMLElement): void {
    // only where a mouse hovers: on touch screens the scene would jump on every tap
    if (!matchMedia('(hover: hover)').matches) return;
    target.addEventListener('pointermove', (e) => {
      const box = target.getBoundingClientRect();
      this.parts?.background.pointAt(((e.clientX - box.left) / box.width - 0.5) * 2);
    });
    target.addEventListener('pointerleave', () => this.parts?.background.pointAt(0));
  }
}

function motionOf(query: MediaQueryList): Motion {
  return {
    get reduced() {
      return query.matches;
    },
  };
}
