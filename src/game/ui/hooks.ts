/** Small hooks the interface components share. */
import { useEffect, useLayoutEffect, useRef, useState, type MutableRef } from 'preact/hooks';
import { CHAMBER_FACE, chamberFit } from './dial';
import { fitLadder } from './ladderFit';

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
 * Fits the ladder in `ref` to its own `max-width` (ladderFit.ts): sets `--gap-fit`
 * and `--rung-fit` on it and returns how many rungs a window shows, null for all.
 * Measures every rung with its "×" under the `measuring` class, again when the
 * stage resizes, the fonts arrive or the next rung changes.
 */
export function useFitLadder(
  ref: MutableRef<HTMLElement | null>,
  labels: string,
  step: number,
): number | null {
  const [size, setSize] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.setProperty('--gap-fit', '1');
      el.style.setProperty('--rung-fit', '1');
      el.classList.add('measuring');
      const css = getComputedStyle(el);
      const rungs = [...el.querySelectorAll<HTMLElement>('.rung')];
      const first = rungs[0];
      const result = fitLadder({
        room: css.maxWidth === 'none' ? Infinity : parseFloat(css.maxWidth),
        rungs: rungs.map((r) => r.getBoundingClientRect().width),
        x: el.querySelector('.rung-x')?.getBoundingClientRect().width ?? 0,
        ellipsis: el.querySelector('.rung-gap')?.getBoundingClientRect().width ?? 0,
        gap: parseFloat(css.columnGap) || 0,
        padding: parseFloat(css.paddingLeft) + parseFloat(css.paddingRight),
        font: first ? parseFloat(getComputedStyle(first).fontSize) : 0,
        step,
      });
      el.classList.remove('measuring');
      el.style.setProperty('--gap-fit', result.gap.toFixed(3));
      el.style.setProperty('--rung-fit', result.rung.toFixed(3));
      setSize(result.window);
    };
    fit();
    let live = true;
    void document.fonts?.ready.then(() => live && fit());
    const stage = el.closest('.stage');
    const observer = stage ? new ResizeObserver(fit) : null;
    if (stage) observer?.observe(stage);
    return () => {
      live = false;
      observer?.disconnect();
    };
  }, [ref, labels, step]);
  return size;
}

/**
 * How `text` fits a chamber of the bet dial (`chamberFit`): the scale for its
 * digits, or null when it does not fit. Measured on `probe`, a hidden chamber
 * holding the text at the chamber's own font, again when the stage resizes or
 * the fonts arrive. 1 for no text.
 */
export function useChamberFit(probe: MutableRef<HTMLElement | null>, text: string): number | null {
  const [fit, setFit] = useState<number | null>(1);
  useLayoutEffect(() => {
    const el = probe.current;
    const digits = el?.firstElementChild;
    if (!el || !(digits instanceof HTMLElement) || !text) {
      setFit(1);
      return;
    }
    const measure = () =>
      setFit(
        chamberFit(
          // layout widths: the drum's turn and the chosen bullet's rise do not count
          digits.offsetWidth,
          el.clientWidth * CHAMBER_FACE,
          parseFloat(getComputedStyle(el).fontSize),
        ),
      );
    measure();
    let live = true;
    void document.fonts?.ready.then(() => live && measure());
    const stage = el.closest('.stage');
    const observer = stage ? new ResizeObserver(measure) : null;
    if (stage) observer?.observe(stage);
    return () => {
      live = false;
      observer?.disconnect();
    };
  }, [probe, text]);
  return fit;
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
