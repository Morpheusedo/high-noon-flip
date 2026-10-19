/**
 * What every part of the scene gets when it is built: the layout for the
 * current orientation, the loaded art, the shared tweens and the motion setting.
 */
import { Assets, type Texture } from 'pixi.js';
import { assetUrl } from '../../shell/assets';
import type { CoinFaces } from './coinArt';
import type { OrientationLayout, SceneLayout } from './layout';
import { fxTextures, type FxTextures } from './textures';
import type { Tweens } from './tween';

export interface ArtTextures {
  background: { landscape: Texture; portrait: Texture };
  /** The chosen skin's faces; `GameScene.setCoin` swaps them while the game runs. */
  coin: CoinFaces;
  revolver: { base: Texture; cocked: Texture; hammer: Texture; strip: Texture };
}

export interface Motion {
  /** The player asked the system for less motion: no shake, particles, parallax or hop. */
  readonly reduced: boolean;
}

export interface SceneContext {
  /** Layout of the current orientation. */
  readonly stage: OrientationLayout;
  readonly layout: SceneLayout;
  readonly art: ArtTextures;
  readonly fx: FxTextures;
  readonly tweens: Tweens;
  readonly motion: Motion;
}

/**
 * Loads every image the scene draws but the coin, whose faces depend on the chosen
 * skin and come in `coin`; `onProgress` gets 0..1 as they arrive.
 */
export async function loadArt(
  layout: SceneLayout,
  coin: Promise<CoinFaces>,
  onProgress?: (fraction: number) => void,
): Promise<{ art: ArtTextures; fx: FxTextures }> {
  const { revolver } = layout;
  const url = (file: string) => assetUrl(`images/${file}`);
  const files = [
    layout.landscape.background.image,
    layout.portrait.background.image,
    revolver.base,
    revolver.cocked,
    revolver.hammer,
    revolver.strip,
  ];
  const [loaded, faces] = await Promise.all([
    Assets.load<Texture>(files.map(url), onProgress),
    coin,
  ]);
  const get = (file: string): Texture => {
    const texture = loaded[url(file)];
    if (!texture) throw new Error(`Image did not load: ${file}`);
    return texture;
  };
  return {
    art: {
      background: {
        landscape: get(layout.landscape.background.image),
        portrait: get(layout.portrait.background.image),
      },
      coin: faces,
      revolver: {
        base: get(revolver.base),
        cocked: get(revolver.cocked),
        hammer: get(revolver.hammer),
        strip: get(revolver.strip),
      },
    },
    fx: fxTextures(),
  };
}
