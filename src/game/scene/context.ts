/**
 * What every part of the scene gets when it is built: the layout for the
 * current orientation, the loaded art, the shared tweens and the motion setting.
 */
import { Assets, type Texture } from 'pixi.js';
import { assetUrl } from '../../shell/assets';
import type { OrientationLayout, SceneLayout } from './layout';
import { fxTextures, type FxTextures } from './textures';
import type { Tweens } from './tween';

export interface ArtTextures {
  background: { landscape: Texture; portrait: Texture };
  coin: { sheriff: Texture; outlaw: Texture };
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

export async function loadArt(layout: SceneLayout): Promise<{ art: ArtTextures; fx: FxTextures }> {
  const load = (file: string) => Assets.load<Texture>(assetUrl(`images/${file}`));
  const { revolver, coin } = layout;
  const [landscape, portrait, sheriff, outlaw, base, cocked, hammer, strip] = await Promise.all([
    load(layout.landscape.background.image),
    load(layout.portrait.background.image),
    load(coin.sheriff),
    load(coin.outlaw),
    load(revolver.base),
    load(revolver.cocked),
    load(revolver.hammer),
    load(revolver.strip),
  ]);
  return {
    art: {
      background: { landscape, portrait },
      coin: { sheriff, outlaw },
      revolver: { base, cocked, hammer, strip },
    },
    fx: fxTextures(),
  };
}
