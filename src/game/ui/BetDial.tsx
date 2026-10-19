/**
 * The bet dial: the revolver's cylinder, sunk into the edge of the screen, with
 * a tab over the chosen chamber that names the amount (`BetTab`, passed in as
 * the children). Drag or flick the drum, scroll over it, tap a bullet, or focus
 * it and use the arrow keys. It is an endless drum over the operator's bet
 * levels; see `dial.ts` for how six chambers show any number of them, and a
 * typed amount between two.
 *
 * A typed amount too long for its chamber at a size that still reads (measured,
 * `chamberFit`) is not squeezed in: the chamber holds a plain pencil mark and the
 * tab over it names the amount, as the slider's value does for a screen reader.
 */
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { nextLevel } from '../../server/bets';
import type { Minor } from '../../server/protocol';
import {
  angleAt,
  CHAMBERS,
  DEG_PER_LEVEL,
  dialStops,
  type Drum,
  followDrum,
  MAX_ANIMATED_JUMP,
  restingLevel,
  slotLevels,
  withGive,
} from './dial';
import type { Formats } from './format';
import { useChamberFit, useTallStage } from './hooks';
import { useText } from './text';
import './BetDial.css';

interface Props {
  /** The operator's levels, ascending. */
  bets: Minor[];
  bet: Minor;
  disabled: boolean;
  fmt: Formats;
  onChange(bet: Minor): void;
  /** Sound cues: one chamber passed the marker, and the drum came to rest after `coasted` levels. */
  feedback: DialFeedback;
  /** The tab over the chosen chamber. */
  children: ComponentChildren;
}

export interface DialFeedback {
  tick(): void;
  settle(coasted: number): void;
}

/** Degrees the drum turns per pixel of finger travel, as a share of its radius. */
const GAIN = 1.9;
const DRAG_THRESHOLD_PX = 5;
/** Pixels of travel a flick adds after release, per pixel per millisecond of speed. */
const COAST_PX_PER_SPEED = 130;

interface Gesture {
  pointer: number;
  start: number;
  /** The stops at the press: the drum keeps them until the finger lifts. */
  stops: readonly Minor[];
  /** Drum position of stop 0. */
  base: number;
  startPos: number;
  /** Where the finger has turned the drum, in stops. */
  raw: number;
  last: number;
  lastAt: number;
  /** Pixels per millisecond, smoothed. */
  speed: number;
  moved: boolean;
  /** Pixels for one level of turn. */
  pxPerLevel: number;
}

export function BetDial({ bets, bet, disabled, fmt, onChange, feedback, children }: Props) {
  const { t } = useText();
  const root = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const wheelAt = useRef(0);
  // the drum's position while a finger turns it, in drum positions
  const [dragPos, setDragPos] = useState<number | null>(null);
  const [spinMs, setSpinMs] = useState(180);
  // on tall screens the dial sits in the right edge: the chosen chamber faces left and a vertical swipe turns it
  const tall = useTallStage(root);
  const offset = tall ? -90 : 0;

  // under a finger the drum keeps the stops it had at the press; otherwise it follows the bet
  const stops = useMemo(() => dialStops(bets, bet), [bets, bet]);
  const last = useRef<Drum | null>(null);
  const held = dragPos === null ? null : gesture.current;
  const heldAt = held ? Math.max(0, held.stops.indexOf(bet)) : 0;
  const drum: Drum = held
    ? { stops: held.stops, index: heldAt, pos: held.base + heldAt }
    : followDrum(last.current, stops, bet);
  // a long jump (Home, End, the bet list) snaps, so no chamber in view changes its number mid-turn
  const jump = Math.abs(drum.pos - (last.current?.pos ?? drum.pos));
  useLayoutEffect(() => {
    last.current = drum;
  });
  const base = drum.pos - drum.index;
  const count = drum.stops.length;
  const spin = dragPos === null && jump > MAX_ANIMATED_JUMP ? 0 : spinMs;
  const pos = dragPos ?? drum.pos;
  const angle = angleAt(pos, offset);
  const levels = slotLevels(pos, count, base);
  const chosen = Math.round(Math.max(0, Math.min(count - 1, pos - base)));
  // a typed amount between the levels shows every digit, or a mark when they would not read
  const typed = drum.stops.find((s) => !bets.includes(s));
  const typedText = typed === undefined ? '' : fmt.exact(typed);
  const typedFit = useChamberFit(probe, typedText);

  /** Sets the bet to `amount`; true if that changed it. */
  const choose = (amount: Minor | null | undefined): boolean => {
    if (amount == null || amount === bet) return false;
    onChange(amount);
    return true;
  };
  const along = (e: PointerEvent) => (tall ? -e.clientY : e.clientX);

  const onPointerDown = (e: PointerEvent) => {
    const el = root.current;
    if (disabled || !el) return;
    const radius = el.offsetWidth / 2;
    gesture.current = {
      pointer: e.pointerId,
      start: along(e),
      stops: drum.stops,
      base,
      startPos: drum.index,
      raw: drum.index,
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
    g.raw = g.startPos - travel / g.pxPerLevel;
    const count = g.stops.length;
    setDragPos(g.base + withGive(g.raw, count));
    const level = Math.max(0, Math.min(count - 1, Math.round(g.raw)));
    if (choose(g.stops[level])) feedback.tick();
  };

  const onPointerUp = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    if (!g.moved) {
      gesture.current = null;
      return;
    }
    // a quick flick keeps the drum turning a little after the finger lifts
    const stale = performance.now() - g.lastAt > 90;
    const coast = stale ? 0 : -(g.speed * COAST_PX_PER_SPEED) / g.pxPerLevel;
    const from = Math.max(-0.5, Math.min(g.stops.length - 0.5, g.raw));
    const target = restingLevel(from, coast, g.stops.length);
    // the drum stands where the finger left it, on the stops it had then
    last.current = { stops: g.stops, index: target, pos: g.base + target };
    gesture.current = null;
    setSpinMs(180 + 50 * Math.min(8, Math.abs(target - from)));
    setDragPos(null);
    choose(g.stops[target]);
    feedback.settle(Math.abs(target - Math.round(from)));
  };

  const onChamber = (level: number | null) => {
    if (disabled || level === null) return;
    setSpinMs(180 + 50 * Math.min(8, Math.abs(level - drum.index)));
    if (choose(drum.stops[level])) feedback.settle(0);
  };

  const to = (amount: Minor | null | undefined) => {
    setSpinMs(180);
    if (choose(amount)) feedback.tick();
  };
  // one step from a typed amount between two levels goes to the level above or below it
  const step = (dir: 1 | -1) => to(nextLevel(bets, bet, dir));

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const now = performance.now();
    if (disabled || Math.abs(d) < 4 || now - wheelAt.current < 70) return;
    wheelAt.current = now;
    step(d > 0 ? 1 : -1);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => step(1),
      ArrowUp: () => step(1),
      ArrowLeft: () => step(-1),
      ArrowDown: () => step(-1),
      Home: () => to(bets[0]),
      End: () => to(bets.at(-1)),
    };
    const press = keys[e.key];
    if (!press || disabled) return;
    e.preventDefault();
    press();
  };

  const amount = fmt.full(bet);
  return (
    <div class="bet-dial" data-locked={disabled || undefined}>
      <div
        ref={root}
        class={`dial${dragPos !== null ? ' dragging' : ''}`}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={t('bet.dial')}
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={drum.index}
        aria-valuetext={amount}
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
            const value = level === null ? undefined : drum.stops[level];
            const mark = value !== undefined && value === typed && typedFit === null;
            const kind = value === undefined ? ' empty' : mark ? ' mark' : '';
            return (
              <div
                class={`dchamber${kind}${level === chosen ? ' on' : ''}`}
                aria-hidden="true"
                style={{
                  '--x': `${c.x}%`,
                  '--y': `${c.y}%`,
                  transform: `rotate(${(-angle).toFixed(2)}deg)`,
                }}
                onClick={() => onChamber(level)}
              >
                {value === undefined ? null : mark ? (
                  <PencilMark />
                ) : value === typed ? (
                  <span class="dnum" style={{ '--fit': typedFit }}>
                    {typedText}
                  </span>
                ) : (
                  <ChamberNumber text={fmt.short(value)} />
                )}
              </div>
            );
          })}
        </div>
        {/* the typed amount at the chamber's font, measured for `useChamberFit` */}
        <div ref={probe} class="dchamber dprobe" aria-hidden="true">
          <span class="dnum">{typedText}</span>
        </div>
      </div>
      {/* the marker over the chosen chamber is a tab that names the bet: the dial alone
          did not read as the bet to players (step 9) */}
      {children}
    </div>
  );
}

/** A level's amount, shrunk by its length so it stays inside the bullet. */
function ChamberNumber({ text }: { text: string }) {
  return (
    <span class="dnum" style={{ '--len': text.length }}>
      {text}
    </span>
  );
}

/** The plain mark in the chamber of a typed amount too long for it: the tab names the amount. */
function PencilMark() {
  return (
    <svg class="dmark" viewBox="0 0 24 24">
      <path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" />
      <path d="M13.8 6.8l3.4 3.4" />
    </svg>
  );
}
