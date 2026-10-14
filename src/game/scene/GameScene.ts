/**
 * The Pixi side of the game: everything painted on the canvas.
 *
 * For now it only lays out the background for the current orientation. The
 * revolver, the coin and the effects move here from the prototype next.
 */
import { Application, Assets, Sprite, type Texture } from 'pixi.js';
import { assetUrl } from '../../shell/assets';

export class GameScene {
  private readonly app = new Application();
  private background: Sprite | null = null;
  private textures: { landscape: Texture; portrait: Texture } | null = null;

  async mount(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    host.appendChild(this.app.canvas);

    const [landscape, portrait] = await Promise.all([
      Assets.load<Texture>(assetUrl('images/background.jpg')),
      Assets.load<Texture>(assetUrl('images/background-portrait.jpg')),
    ]);
    this.textures = { landscape, portrait };
    this.background = new Sprite(landscape);
    this.background.anchor.set(0.5);
    this.app.stage.addChild(this.background);

    this.app.renderer.on('resize', () => this.layout());
    this.layout();
  }

  private layout(): void {
    const bg = this.background;
    if (!bg || !this.textures) return;
    const { width, height } = this.app.screen;
    bg.texture = height > width ? this.textures.portrait : this.textures.landscape;
    // cover: fill the stage, crop what does not fit
    const scale = Math.max(width / bg.texture.width, height / bg.texture.height);
    bg.scale.set(scale);
    bg.position.set(width / 2, height / 2);
  }
}
