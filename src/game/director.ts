/**
 * The director turns phase changes into presentation and tells the model when
 * each part is over.
 *
 * This first version only waits: it stands in for the coin flight and the
 * result stamp until the Pixi scene is ported. The real director will await
 * the scene's animations in the same two places.
 */
import type { RoundModel } from './model/RoundModel';

export interface Timings {
  /** Coin in the air. */
  revealMs: number;
  /** Result stamp on screen. */
  resultMs: number;
}

export const PLACEHOLDER_TIMINGS: Timings = { revealMs: 900, resultMs: 1200 };

export function startDirector(
  model: RoundModel,
  timings: Timings = PLACEHOLDER_TIMINGS,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = model.store.subscribe((state, previous) => {
    if (state.phase.name === previous.phase.name) return;
    clearTimeout(timer);
    if (state.phase.name === 'revealing')
      timer = setTimeout(() => model.finishReveal(), timings.revealMs);
    if (state.phase.name === 'result')
      timer = setTimeout(() => model.finishResult(), timings.resultMs);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
