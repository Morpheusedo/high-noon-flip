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
 * Positions are measured in levels: 0 is the lowest bet, 2.5 is halfway
 * between the third and the fourth.
 */
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

/** The level shown in each chamber at drum position `pos`; null for an empty chamber. */
export function slotLevels(pos: number, count: number): (number | null)[] {
  return CHAMBERS.map((_, slot) => {
    const level = slot + SLOTS * Math.round((pos - slot) / SLOTS);
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
