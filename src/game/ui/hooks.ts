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

/** `value`, counted up over 0.8 s when it grows; drops at once. */
export function useCountUp(value: number, reduced: boolean): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    if (reduced || value <= from) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 800);
      current.current = Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)));
      setShown(current.current);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return shown;
}

/**
 * Shrinks the text in `ref` so it fits its own `max-width`: a long balance
 * gets a smaller font instead of running into the bet dial. Sets `--fit`.
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
