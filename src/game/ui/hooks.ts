/** Small hooks the interface components share. */
import { useEffect, useLayoutEffect, useRef, useState, type MutableRef } from 'preact/hooks';

const reducedQuery =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(reducedQuery?.matches ?? false);
  useEffect(() => {
    if (!reducedQuery) return;
    const update = () => setReduced(reducedQuery.matches);
    reducedQuery.addEventListener('change', update);
    return () => reducedQuery.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** True while the stage around `ref` is the tall 9:16 one. */
export function useTallStage(ref: MutableRef<HTMLElement | null>): boolean {
  const [tall, setTall] = useState(false);
  useLayoutEffect(() => {
    const stage = ref.current?.closest<HTMLElement>('.stage');
    if (!stage) return;
    const update = () => setTall(stage.clientHeight > stage.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [ref]);
  return tall;
}

interface CountUp {
  /** How long the count takes, in milliseconds. */
  duration?: number;
  /** How long the old value stays before the count starts, e.g. while coins fly to it. */
  delay?: number;
}

/** `value`, counted up (0.8 s by default) when it grows; drops at once. */
export function useCountUp(
  value: number,
  reduced: boolean,
  { duration = 800, delay = 0 }: CountUp = {},
): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    if (reduced || value <= from) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = performance.now() + delay;
    let frame = 0;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - start) / duration));
      current.current = Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)));
      setShown(current.current);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // the delay is read when a new value arrives; changing it alone restarts nothing
  }, [value, reduced, duration]);
  return shown;
}

/**
 * Shrinks the text in `ref` so it fits its own `max-width`: a long balance
 * gets a smaller font instead of running into the bet. Sets `--fit`.
 */
export function useFitText(ref: MutableRef<HTMLElement | null>, text: string): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.setProperty('--fit', '1');
      const ratio = el.clientWidth / Math.max(1, el.scrollWidth);
      el.style.setProperty('--fit', Math.max(0.4, Math.min(1, ratio)).toFixed(3));
    };
    fit();
    const stage = el.closest('.stage');
    if (!stage) return;
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [ref, text]);
}

/**
 * How far to lift `ref` so a phone keyboard does not hide it, in CSS pixels; 0
 * with no keyboard up. Phones keep the page's size under the keyboard and only
 * shrink or pan the visual viewport, so the element is measured against what is
 * still in sight. Measure an element the lift does not move (the lifted one's
 * wrapper), or the lift would feed back into itself. Driven by the viewport
 * alone, not by focus: a tap on a button beside the field must not move it.
 */
export function useKeyboardLift(ref: MutableRef<HTMLElement | null>, margin: number): number {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    const stage = el?.closest('.stage');
    if (!vv || !el || !stage) return;
    const update = () => {
      const box = el.getBoundingClientRect();
      const frame = stage.getBoundingClientRect();
      const visible = vv.offsetTop + vv.height;
      // a pinch zoom shrinks the visual viewport too; only a keyboard does it at scale 1
      const keyboard =
        Math.abs(vv.scale - 1) < 0.01 && frame.bottom - visible > frame.height * 0.15;
      setLift(keyboard ? Math.max(0, Math.round(box.bottom + margin - visible)) : 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [ref, margin]);
  return lift;
}
