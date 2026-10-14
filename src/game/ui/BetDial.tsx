/**
 * The bet dial: the revolver's cylinder, half sunk into the edge of the screen.
 * Drag or flick it, scroll over it, tap a bullet, or focus it and use the
 * arrow keys. It is an endless drum over the operator's bet levels; see
 * `dial.ts` for how six chambers show any number of them.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Minor } from '../../server/protocol';
import {
  angleAt,
  CHAMBERS,
  DEG_PER_LEVEL,
  MAX_ANIMATED_JUMP,
  restingLevel,
  slotLevels,
  withGive,
} from './dial';
import { useTallStage } from './hooks';
import { text } from './text';
import './BetDial.css';

interface Props {
  bets: Minor[];
  bet: Minor;
  disabled: boolean;
  /** Full amount with currency, read out by screen readers. */
  label(bet: Minor): string;
  /** Short amount printed on a bullet. */
  short(bet: Minor): string;
  onChange(bet: Minor): void;
}

/** Degrees the drum turns per pixel of finger travel, as a share of its radius. */
const GAIN = 1.9;
const DRAG_THRESHOLD_PX = 5;
/** Pixels of travel a flick adds after release, per pixel per millisecond of speed. */
const COAST_PX_PER_SPEED = 130;

interface Gesture {
  pointer: number;
  start: number;
  startPos: number;
  last: number;
  lastAt: number;
  /** Pixels per millisecond, smoothed. */
  speed: number;
  moved: boolean;
  /** Pixels for one level of turn. */
  pxPerLevel: number;
}

export function BetDial({ bets, bet, disabled, label, short, onChange }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const wheelAt = useRef(0);
  const [dragPos, setDragPos] = useState<number | null>(null);
  const [spinMs, setSpinMs] = useState(180);
  // on tall screens the dial sits in the right edge: the chosen chamber faces left and a vertical swipe turns it
  const tall = useTallStage(root);
  const offset = tall ? -90 : 0;

  const count = bets.length;
  const index = Math.max(0, bets.indexOf(bet));
  // a long jump (Home, End, the bet list) snaps, so no chamber in view changes its number mid-turn
  const shownIndex = useRef(index);
  const jump = Math.abs(index - shownIndex.current);
  useEffect(() => {
    shownIndex.current = index;
  }, [index]);
  const spin = dragPos === null && jump > MAX_ANIMATED_JUMP ? 0 : spinMs;
  const pos = dragPos ?? index;
  const angle = angleAt(pos, offset);
  const levels = slotLevels(pos, count);
  const chosen = Math.round(Math.max(0, Math.min(count - 1, pos)));

  const choose = (level: number) => {
    const next = bets[Math.max(0, Math.min(count - 1, level))];
    if (next !== undefined && next !== bet) onChange(next);
  };
  const along = (e: PointerEvent) => (tall ? -e.clientY : e.clientX);

  const onPointerDown = (e: PointerEvent) => {
    const el = root.current;
    if (disabled || !el) return;
    const radius = el.offsetWidth / 2;
    gesture.current = {
      pointer: e.pointerId,
      start: along(e),
      startPos: index,
      last: along(e),
      lastAt: performance.now(),
      speed: 0,
      moved: false,
      pxPerLevel: (DEG_PER_LEVEL * radius) / (57.3 * GAIN),
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    const travel = along(e) - g.start;
    if (!g.moved && Math.abs(travel) > DRAG_THRESHOLD_PX) {
      // from here on it is a drag: keep the pointer even off the dial, and the click
      // that ends it lands on the dial rather than on a bullet
      g.moved = true;
      root.current?.setPointerCapture(e.pointerId);
    }
    if (!g.moved) return;
    const now = performance.now();
    g.speed = g.speed * 0.5 + ((along(e) - g.last) / Math.max(1, now - g.lastAt)) * 0.5;
    g.last = along(e);
    g.lastAt = now;
    // turning the drum one way brings the next level up; the bet follows the finger at once
    const raw = g.startPos - travel / g.pxPerLevel;
    setDragPos(withGive(raw, count));
    choose(Math.round(raw));
  };

  const onPointerUp = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    gesture.current = null;
    if (!g.moved) return;
    // a quick flick keeps the drum turning a little after the finger lifts
    const stale = performance.now() - g.lastAt > 90;
    const coast = stale ? 0 : -(g.speed * COAST_PX_PER_SPEED) / g.pxPerLevel;
    const from = dragPos ?? index;
    const target = restingLevel(from, coast, count);
    setSpinMs(180 + 50 * Math.min(8, Math.abs(target - from)));
    setDragPos(null);
    choose(target);
  };

  const onChamber = (level: number | null) => {
    if (disabled || level === null) return;
    setSpinMs(180 + 50 * Math.min(8, Math.abs(level - index)));
    choose(level);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const now = performance.now();
    if (disabled || Math.abs(d) < 4 || now - wheelAt.current < 70) return;
    wheelAt.current = now;
    setSpinMs(180);
    choose(index + (d > 0 ? 1 : -1));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const to: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowUp: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index - 1,
      Home: 0,
      End: count - 1,
    };
    const level = to[e.key];
    if (level === undefined || disabled) return;
    e.preventDefault();
    setSpinMs(180);
    choose(level);
  };

  return (
    <div
      ref={root}
      class={`dial${dragPos !== null ? ' dragging' : ''}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={text.betDial}
      aria-valuemin={0}
      aria-valuemax={count - 1}
      aria-valuenow={index}
      aria-valuetext={label(bet)}
      aria-disabled={disabled}
      style={{ '--spin': `${spin}ms` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      <div class="dial-rot" style={{ transform: `rotate(${angle.toFixed(2)}deg)` }}>
        {CHAMBERS.map((c, slot) => {
          const level = levels[slot] ?? null;
          const value = level === null ? undefined : bets[level];
          return (
            <div
              class={`dchamber${value === undefined ? ' empty' : ''}${level === chosen ? ' on' : ''}`}
              aria-hidden="true"
              style={{
                '--x': `${c.x}%`,
                '--y': `${c.y}%`,
                transform: `rotate(${(-angle).toFixed(2)}deg)`,
              }}
              onClick={() => onChamber(level)}
            >
              {value !== undefined && (
                <span class="dnum" style={{ '--len': short(value).length }}>
                  {short(value)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
