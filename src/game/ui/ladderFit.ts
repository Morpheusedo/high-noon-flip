/**
 * How the ladder under the title fits the width it has (in portrait, between the
 * corner buttons). The gaps give way first, then the rungs; below a readable size
 * the row shows a window of rungs instead of all of them. Pure, so it is tested
 * without a browser; `useFitLadder` (hooks.ts) measures and applies it.
 */

/** The narrowest gap between two rungs, in CSS pixels. */
export const GAP_MIN_PX = 4;
/** The smallest rung digits, in CSS pixels. */
export const FONT_MIN_PX = 9;
/** Fewest rungs a window shows: the next one and the top. */
const WINDOW_MIN = 2;

/** The ladder as measured with every rung at full size and with its "×". */
export interface LadderMeasure {
  /** The width the ladder may take; Infinity where nothing limits it. */
  room: number;
  /** Each rung's width, its "×" included. */
  rungs: number[];
  /** The width of one "×": only the next rung shows it. */
  x: number;
  /** The ellipsis that stands for the rungs a window leaves out. */
  ellipsis: number;
  /** One gap between rungs. */
  gap: number;
  /** The ladder's padding, both sides together. */
  padding: number;
  /** The rungs' font size. */
  font: number;
  /** Rungs climbed so far: the one at this index is the next and shows its "×". */
  step: number;
}

export interface LadderFit {
  /** Scale of the gaps and the padding. */
  gap: number;
  /** Scale of the rungs: their digits and bullets. */
  rung: number;
  /** How many rungs a window shows; null shows them all. */
  window: number | null;
}

export function fitLadder(m: LadderMeasure): LadderFit {
  const n = m.rungs.length;
  // only the next rung keeps its "×"; after the top rung none does
  const xs = m.step < n ? n - 1 : n;
  const rungs = m.rungs.reduce((a, w) => a + w, 0) - xs * m.x;
  const space = m.gap * Math.max(0, n - 1) + m.padding;
  const gapMin = m.gap > 0 ? Math.min(1, GAP_MIN_PX / m.gap) : 1;
  const rungMin = m.font > 0 ? Math.min(1, FONT_MIN_PX / m.font) : 1;

  if (rungs + space <= m.room) return { gap: 1, rung: 1, window: null };
  if (rungs + gapMin * space <= m.room)
    return { gap: (m.room - rungs) / space, rung: 1, window: null };
  const rung = (m.room - gapMin * space) / rungs;
  if (rung >= rungMin) return { gap: gapMin, rung, window: null };

  // A window of k rungs and the ellipsis is k + 1 items. Each rung is counted as the
  // widest with its "×", so the count stays the same while the run climbs.
  const widest = Math.max(...m.rungs);
  const width = (k: number, gap: number) =>
    rungMin * (k * widest + m.ellipsis) + gap * (m.gap * k + m.padding);
  let k = n - 1;
  while (k > WINDOW_MIN && width(k, gapMin) > m.room) k--;
  // what is left over goes back to the gaps
  const rest = m.room - rungMin * (k * widest + m.ellipsis);
  const gap = Math.max(gapMin, Math.min(1, rest / (m.gap * k + m.padding)));
  return { gap, rung: rungMin, window: k };
}

export interface LadderWindow {
  /** Whether each rung is on the row; the others stay for a screen reader. */
  shown: boolean[];
  /** The ellipsis stands before the top rung. */
  ellipsis: boolean;
}

/**
 * The rungs a window of `size` shows at `step`: the last climbed, the next and
 * the ones after it, then the top rung (the maximum win) after an ellipsis. Near
 * the top the window is the last `size` rungs in a row.
 */
export function ladderWindow(n: number, step: number, size: number | null): LadderWindow {
  if (size === null || size >= n) return { shown: Array<boolean>(n).fill(true), ellipsis: false };
  const top = n - 1;
  const next = Math.min(step, top);
  // the last climbed rung only when there is a slot for it besides the next and the top
  const first = next > 0 && size >= 3 ? next - 1 : next;
  const last = first + size - 2;
  if (last >= top - 1) {
    const from = n - size;
    return { shown: Array.from({ length: n }, (_, i) => i >= from), ellipsis: false };
  }
  return {
    shown: Array.from({ length: n }, (_, i) => (i >= first && i <= last) || i === top),
    ellipsis: true,
  };
}
