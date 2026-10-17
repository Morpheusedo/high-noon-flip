/**
 * Desktop layout variants under exploration, picked from the launch URL in demo
 * mode only: `?layout=a`. The variant is a `data-layout` attribute on `.hud`
 * with CSS overrides in `layouts.css`, a separate chunk that only this
 * parameter downloads, so the default layout and the game code stay as they are.
 *
 * `compare=idle` or `compare=run` is for `public/compare.html`, which shows the
 * variants side by side in iframes: each frame gets a fresh session of its own
 * (no saved state shared with the other frames or with the player's session),
 * and `run` opens a run at the third rung so the cash out shows too.
 *
 * An exploration: once a variant is picked it becomes the default layout and
 * this module goes.
 */
import type { PlayMode } from '../shell/launchParams';

export const LAYOUTS = ['a', 'b', 'c'] as const;
export type Layout = (typeof LAYOUTS)[number];

export interface LayoutPreview {
  layout: Layout | null;
  compare: 'idle' | 'run' | null;
}

export function readLayoutPreview(search: string, mode: PlayMode): LayoutPreview {
  if (mode !== 'demo') return { layout: null, compare: null };
  const q = new URLSearchParams(search);
  const layout = LAYOUTS.find((l) => l === q.get('layout')) ?? null;
  const c = q.get('compare');
  return { layout, compare: c === 'idle' || c === 'run' ? c : null };
}

/** The rung and the stake of the open run a `compare=run` frame starts with. */
export const COMPARE_RUN = { step: 3, bet: 100 };
