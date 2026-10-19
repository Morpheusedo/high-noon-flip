/**
 * The coin's faces for a skin, loaded when it is first needed: the chosen skin
 * with the game, any other when the player chooses it.
 *
 * A skin is a cosmetic. Its art missing is not a loading error, unlike the rest
 * of the scene: the coin keeps the classic faces and the console says why.
 */
import { Assets, type Texture } from 'pixi.js';
import { classicOf, coinUrl, colorOf, skinOf, type CoinManifest } from '../collection/skins';

export interface CoinFaces {
  /** The skin these faces are; the classic one's id when the skin's art is missing. */
  id: string;
  sheriff: Texture;
  outlaw: Texture;
  /** The edge in shade, in light, and its bright streak. */
  rim: readonly [number, number, number];
}

/** Loads images by URL, in order; rejects when one of them fails. Tests pass a fake. */
export type LoadTextures = (urls: string[]) => Promise<Texture[]>;

export class CoinArt {
  private readonly cache = new Map<string, Promise<CoinFaces>>();

  constructor(
    private readonly manifest: CoinManifest,
    private readonly load: LoadTextures = loadWithPixi,
  ) {}

  /** The faces of skin `id`; the classic ones, with a console warning, when its art is missing. */
  faces(id: string): Promise<CoinFaces> {
    let faces = this.cache.get(id);
    if (!faces) {
      faces = this.fetch(id);
      this.cache.set(id, faces);
      // a classic coin that failed may load on a later try
      faces.catch(() => this.cache.delete(id));
    }
    return faces;
  }

  private async fetch(id: string): Promise<CoinFaces> {
    const classic = classicOf(this.manifest);
    const skin = skinOf(this.manifest, id);
    if (skin && skin !== classic) {
      try {
        const [sheriff, outlaw] = await this.load([coinUrl(skin.sheriff), coinUrl(skin.outlaw)]);
        if (sheriff && outlaw) return { id, sheriff, outlaw, rim: rimOf(skin.rim) };
        throw new Error('missing texture');
      } catch (err) {
        console.warn(`Coin "${id}": art is missing, showing the classic coin`, err);
        return this.faces(classic.id);
      }
    }
    if (!skin) console.warn(`Coin "${id}" is not in coins.json, showing the classic coin`);
    // the classic coin is part of the game's art: its failure is a loading error
    const [sheriff, outlaw] = await this.load([coinUrl(classic.sheriff), coinUrl(classic.outlaw)]);
    if (!sheriff || !outlaw) throw new Error('Image did not load: the classic coin');
    return { id: classic.id, sheriff, outlaw, rim: rimOf(classic.rim) };
  }
}

function rimOf(rim: readonly [string, string, string]): readonly [number, number, number] {
  return [colorOf(rim[0]), colorOf(rim[1]), colorOf(rim[2])];
}

async function loadWithPixi(urls: string[]): Promise<Texture[]> {
  const loaded = await Assets.load<Texture>(urls);
  return urls.map((url) => {
    const texture = loaded[url];
    if (!texture) throw new Error(`Image did not load: ${url}`);
    return texture;
  });
}
