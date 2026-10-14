/**
 * The loading screen. Shared by every game.
 *
 * Its markup and styles are inline in index.html, so the branded screen shows
 * before any script has loaded. This module only moves the bar, shows a
 * loading error, and fades the screen out when the game is ready.
 */

/**
 * Progress over several tasks of different size. Each task reports its own 0..1;
 * the bar shows the weighted sum and never moves back.
 */
export class LoadProgress {
  private readonly tasks: { weight: number; done: number }[] = [];
  private shown = 0;

  constructor(private readonly onChange: (fraction: number) => void) {}

  /** A task of `weight` parts; call the returned function with its own progress. */
  add(weight: number): (fraction: number) => void {
    const task = { weight, done: 0 };
    this.tasks.push(task);
    return (fraction) => {
      task.done = Math.min(1, Math.max(task.done, fraction));
      this.changed();
    };
  }

  /** A task that is either not done or done. */
  track<T>(work: Promise<T>, weight: number): Promise<T> {
    const report = this.add(weight);
    return work.then((value) => {
      report(1);
      return value;
    });
  }

  get fraction(): number {
    const total = this.tasks.reduce((sum, t) => sum + t.weight, 0);
    if (total === 0) return 0;
    return this.tasks.reduce((sum, t) => sum + t.weight * t.done, 0) / total;
  }

  private changed(): void {
    const next = this.fraction;
    if (next <= this.shown) return;
    this.shown = next;
    this.onChange(next);
  }
}

export interface LoaderScreen {
  progress(fraction: number): void;
  /** Names the progress bar for screen readers, once the player's language is known. */
  label(text: string): void;
  /** Stops the bar and shows what went wrong with one way out. */
  fail(message: string, hint: string, action: string, onAction: () => void): void;
  /** Fades out and removes itself. */
  hide(): void;
}

export function loaderScreen(root: HTMLElement): LoaderScreen {
  const bar = root.querySelector<HTMLElement>('[role="progressbar"]');
  const fill = root.querySelector<HTMLElement>('.loader-fill');
  const percent = root.querySelector<HTMLElement>('.loader-percent');
  return {
    progress(fraction) {
      const value = Math.round(fraction * 100);
      fill?.style.setProperty('--progress', String(fraction));
      bar?.setAttribute('aria-valuenow', String(value));
      if (percent) percent.textContent = `${value}%`;
    },
    label(text) {
      bar?.setAttribute('aria-label', text);
    },
    fail(message, hint, action, onAction) {
      root.dataset.state = 'error';
      const box = root.querySelector<HTMLElement>('.loader-error');
      if (!box) return;
      const title = document.createElement('p');
      title.className = 'loader-error-title';
      title.textContent = message;
      const note = document.createElement('p');
      note.textContent = hint;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.textContent = action;
      button.addEventListener('click', onAction);
      box.replaceChildren(title, note, button);
      box.hidden = false;
      button.focus();
    },
    hide() {
      root.dataset.state = 'done';
      const remove = () => root.remove();
      root.addEventListener('transitionend', remove, { once: true });
      // no transition under reduced motion, or the tab is in the background
      setTimeout(remove, 600);
    },
  };
}

/**
 * Waits for the interface fonts, but never longer than `timeoutMs`: a blocked
 * font host must not keep the game from starting. Fallback fonts are fine.
 */
export function loadFonts(faces: readonly string[], timeoutMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  const all = Promise.all(faces.map((f) => document.fonts.load(f))).then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([all, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
