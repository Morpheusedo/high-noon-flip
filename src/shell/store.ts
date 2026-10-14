/**
 * A tiny observable value: the one way state reaches the screen.
 *
 * The model owns a store and replaces its state with a new object on every
 * change. The Pixi scene and the Preact interface subscribe and redraw; they
 * never change the state themselves.
 */
export type Listener<T> = (state: T, previous: T) => void;

export class Store<T> {
  private state: T;
  private readonly listeners = new Set<Listener<T>>();

  constructor(initial: T) {
    this.state = initial;
  }

  get(): T {
    return this.state;
  }

  set(next: T): void {
    const previous = this.state;
    if (next === previous) return;
    this.state = next;
    for (const listener of this.listeners) listener(next, previous);
  }

  /** Calls `listener` on every change; returns a function that stops it. */
  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
