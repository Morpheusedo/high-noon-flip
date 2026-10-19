/**
 * Where things go on the stage and where the parts are on the art.
 *
 * The numbers live in `public/assets/images/scene-layout.json`, next to the
 * images they were measured on, so new art comes with its own measurements and
 * no code changes. This file describes that JSON and checks it on load: a
 * broken layout stops the game at start-up, not halfway through a round.
 *
 * Two kinds of numbers:
 * - per orientation, in stage units: the stage is `width` x `height` design
 *   pixels and the scene scales it to fit the canvas;
 * - measured on an image, in that image's own pixels.
 */
import { Assets } from 'pixi.js';
import { assetUrl } from '../../shell/assets';

const N = 'number';
const S = 'string';

const ORIENTATION = {
  /** Design size of the stage. */
  width: N,
  height: N,
  /** Motion amplitude (recoil, smoke spread, sparks) in stage pixels. */
  unit: N,
  background: {
    image: S,
    /** Centre of the sun, as fractions of the stage, and the size of the shade over it. */
    sun: { x: N, y: N, size: N },
  },
  coin: {
    /** Resting centre, as fractions of the stage. */
    x: N,
    y: N,
    radius: N,
    /** How high the coin rises in flight, in coin radii. */
    hop: N,
  },
  revolver: {
    /** Centre line and the muzzle height, as fractions of the stage. */
    x: N,
    top: N,
    /** On-screen width of the barrel; the whole picture scales from it. */
    barrelWidth: N,
    /** Vertical squash so the cylinder stays on screen. */
    squash: N,
  },
} as const;

const SHAPE = {
  landscape: ORIENTATION,
  portrait: ORIENTATION,
  background: {
    /** Draw the photo this much oversize, so blur and parallax never show its edges. */
    overscan: N,
    blur: N,
  },
  /** The faces of each skin are listed in `coins/coins.json`; they all share this frame. */
  coin: {
    /** Radius of the round face inside a coin image, as a fraction of the half-width. */
    faceInset: N,
  },
  /** Measured on `revolver.base`; x is from the gun's centre line, y from the muzzle. */
  revolver: {
    base: S,
    /** Same picture with the cylinder turned one chamber. */
    cocked: S,
    hammer: S,
    /** The engraved cylinder surface, unrolled. */
    strip: S,
    /** Barrel width as a fraction of the image width. */
    barrelOfWidth: N,
    /** Bottom centre of the hammer, where it hinges. */
    hammerPivot: { x: N, y: N },
    /** Rounded box around the cylinder: the light streak stays inside it. */
    cylinder: { x: N, y: N, width: N, height: N, radius: N },
    /** The two visible sides of the cylinder, as polygons [x0, y0, x1, y1, ...]. */
    cylinderLeft: [N],
    cylinderRight: [N],
    /** The strip shown on each side while the cylinder spins. */
    spin: {
      top: N,
      width: N,
      height: N,
      leftX: N,
      rightX: N,
      tileScale: N,
      /** Strip width that makes one chamber, in strip pixels. */
      period: N,
      /** Phase shift of the right side against the left, in strip pixels. */
      rightPhase: N,
    },
    /** The light streak that crosses the cylinder as it is cocked. */
    streak: { y: N, fromX: N, toX: N },
  },
} as const;

type FromShape<T> = T extends typeof N
  ? number
  : T extends typeof S
    ? string
    : T extends readonly [infer E]
      ? FromShape<E>[]
      : { readonly [K in keyof T]: FromShape<T[K]> };

export type SceneLayout = FromShape<typeof SHAPE>;
export type OrientationLayout = SceneLayout['landscape'];
export type Orientation = 'landscape' | 'portrait';

export async function loadLayout(): Promise<SceneLayout> {
  const json: unknown = await Assets.load({
    src: assetUrl('images/scene-layout.json'),
    parser: 'json',
  });
  check(json, SHAPE, 'scene-layout.json');
  return json as SceneLayout;
}

function check(value: unknown, shape: unknown, path: string): void {
  if (shape === N || shape === S) {
    if (typeof value !== shape || (shape === N && !Number.isFinite(value)))
      throw new Error(`${path} must be a ${shape}`);
    return;
  }
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) throw new Error(`${path} must be a list`);
    value.forEach((item, i) => check(item, shape[0], `${path}[${i}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) throw new Error(`${path} must be an object`);
  for (const [key, inner] of Object.entries(shape as object))
    check((value as Record<string, unknown>)[key], inner, `${path}.${key}`);
}
