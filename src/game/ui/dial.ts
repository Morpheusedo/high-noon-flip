/**
 * The bet dial's arithmetic, kept apart from the component so it can be tested.
 *
 * The cylinder art has six chambers, but an operator sends any number of bet
 * levels. The dial is an endless drum: turning it one chamber (60°) moves one
 * level, and each chamber shows the level nearest to it in turning order. A
 * chamber gets a new label only while it is on the far side, out of view, so
 * the player never sees a number change. The drum stops at the lowest and the
 * highest level; it never wraps from the top bet to the bottom one.
 *
 * The drum stops at the operator's levels and, when the player typed a bet
 * between two of them, at that amount too, in its place (`dialStops`): the
 * chamber under the marker always shows the real stake, and one turn from it
 * goes to the next level up or down, as − and + did.
 *
 * Positions are measured in stops: 0 is the lowest, 2.5 is halfway between the
 * third and the fourth. The drum's own position is the stop's index plus a
 * `base`, which `followDrum` moves when a typed amount joins or leaves the
 * stops, so every amount keeps its chamber and the drum turns to it.
 */
import type { Minor } from '../../server/protocol';
import cylinder from './art/cylinder.json';

/** Chamber centres on `cylinder.webp`, in percent; chamber i sits i x 60° clockwise from the top. */
export const CHAMBERS: readonly { x: number; y: number }[] = cylinder.chambers;
export const SLOTS = CHAMBERS.length;
export const DEG_PER_LEVEL = 360 / SLOTS;
/** How far past the last level the drum gives under a finger, in levels. */
const GIVE = 0.35;
/**
 * The furthest a flick carries the drum after the finger lifts, in levels. Kept
 * under three so no chamber in view needs a new label while the drum settles.
 */
const MAX_COAST = 2;
/** A jump longer than this would relabel a chamber in view: it snaps instead of turning. */
export const MAX_ANIMATED_JUMP = 2;

/** The levels, and a typed bet between them in its place. Levels come in ascending order. */
export function dialStops(levels: readonly Minor[], bet: Minor): Minor[] {
  if (levels.includes(bet)) return [...levels];
  const above = levels.findIndex((b) => b > bet);
  const at = above < 0 ? levels.length : above;
  return [...levels.slice(0, at), bet, ...levels.slice(at)];
}

/** Where the drum stands: the stops it shows and the drum position of the chosen one. */
export interface Drum {
  stops: readonly Minor[];
  /** Drum position of `stops[index]`; it differs from `index` by the drum's base. */
  pos: number;
  index: number;
}

/**
 * The drum after the bet became `bet` with `stops`. An amount the drum already
 * showed keeps its drum position, so the drum turns to it; a new one (typed in
 * the list) takes its place by index, which a long jump snaps to anyway.
 */
export function followDrum(prev: Drum | null, stops: readonly Minor[], bet: Minor): Drum {
  const index = Math.max(0, stops.indexOf(bet));
  if (!prev) return { stops, pos: index, index };
  const base = prev.pos - prev.index;
  const before = prev.stops.indexOf(bet);
  return { stops, pos: before < 0 ? base + index : base + before, index };
}

/**
 * The stop shown in each chamber at drum position `pos`, for a drum whose stop 0
 * stands at drum position `base`; null for an empty chamber.
 */
export function slotLevels(pos: number, count: number, base = 0): (number | null)[] {
  return CHAMBERS.map((_, slot) => {
    const level = slot + SLOTS * Math.round((pos - slot) / SLOTS) - base;
    return level >= 0 && level < count ? level : null;
  });
}

/** Rotation of the drum, in degrees, that brings `pos` under the marker. */
export function angleAt(pos: number, offsetDeg: number): number {
  return offsetDeg - pos * DEG_PER_LEVEL;
}

/** A position dragged past either end, pulled back so it only gives a little. */
export function withGive(pos: number, count: number): number {
  const last = count - 1;
  if (pos < 0) return -GIVE * (1 - 1 / (1 - pos));
  if (pos > last) return last + GIVE * (1 - 1 / (1 + pos - last));
  return pos;
}

/** The level the drum comes to rest on after a release with `coast` levels of momentum. */
export function restingLevel(pos: number, coast: number, count: number): number {
  const carried = pos + Math.max(-MAX_COAST, Math.min(MAX_COAST, coast));
  return Math.max(0, Math.min(count - 1, Math.round(carried)));
}

/**
 * The share of a chamber's width its digits may take: all of it. They reach over the
 * bullet's rim, as a level's "7.50" does at full size, and the chosen bullet rises
 * a quarter larger still.
 */
export const CHAMBER_FACE = 1;
/** The smallest digits a chamber shows, in CSS pixels: below that they no longer read on a phone. */
export const MIN_CHAMBER_DIGITS_PX = 9;
/** Nor smaller than this share of the chamber's own font, or they would look lost beside the levels. */
export const MIN_CHAMBER_SHARE = 0.6;

/**
 * How a typed amount fits its chamber: the scale for its digits (1 at the
 * chamber's own size), or null when it would have to shrink past the smallest
 * that reads, and the chamber shows a mark instead while the tab names the
 * amount. Measured, not counted in digits: "1,111" and "8,888" differ in width,
 * and the font and the chamber change with the stage.
 *
 * `width` is the amount's width at the chamber's font, `room` the width the
 * bullet's face leaves for it, `font` the chamber's font size, all in pixels.
 */
export function chamberFit(width: number, room: number, font: number): number | null {
  if (width <= room) return 1;
  const scale = room / width;
  const smallest = Math.max(MIN_CHAMBER_DIGITS_PX, font * MIN_CHAMBER_SHARE);
  return font * scale >= smallest ? scale : null;
}
