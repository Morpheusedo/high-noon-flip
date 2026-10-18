/**
 * The money of a cash out flying to the balance: a few coins on an arc from the
 * plaque to the balance plaque, then the balance counts up (`PAYOUT_FLIGHT_MS`
 * holds its count). Looks only: the balance is the server's, already in the state.
 *
 * Transform and opacity only, so the compositor moves them; they never take a
 * tap, and they are gone when they land.
 */
import { useEffect } from 'preact/hooks';
import './Payout.css';

/** From the first coin leaving to the last one landing. */
export const PAYOUT_FLIGHT_MS = 550;
const COIN_MS = 400;
const COINS = 7;
const STAGGER_MS = (PAYOUT_FLIGHT_MS - COIN_MS) / (COINS - 1);

export interface Point {
  x: number;
  y: number;
}

/** Where each coin leaves from, around the middle of the plaque, in its width and height. */
const SPREAD: readonly Point[] = [
  { x: 0.18, y: -0.1 },
  { x: -0.08, y: 0.12 },
  { x: 0.3, y: 0.15 },
  { x: -0.25, y: -0.05 },
  { x: 0.05, y: -0.2 },
  { x: -0.35, y: 0.1 },
  { x: 0.4, y: -0.12 },
];

interface Props {
  /** The cash out plaque: its middle and size, in the interface's own pixels. */
  from: Point & { width: number; height: number };
  /** The middle of the balance plaque. */
  to: Point;
  onDone(): void;
}

export function Payout({ from, to, onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, PAYOUT_FLIGHT_MS + 50);
    return () => clearTimeout(timer);
  }, [onDone]);
  // the arc rises above the higher of the two ends. Near the end it overshoots the
  // balance by about half its lift, so with the balance in the top corner the lift
  // (and the spread added below) stays under the balance's height on the stage
  const lift = Math.min(Math.max(40, Math.abs(to.x - from.x) * 0.25), to.y - 24);
  return (
    <div class="payout" aria-hidden="true">
      {SPREAD.slice(0, COINS).map((p, i) => {
        const x = from.x + p.x * from.width * 0.5;
        const y = from.y + p.y * from.height;
        return (
          <span
            class="payout-coin"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              '--dx': `${to.x - x}px`,
              '--dy': `${to.y - y}px`,
              '--lift': `${lift + (i % 3) * 12}px`,
              '--delay': `${Math.round(i * STAGGER_MS)}ms`,
              '--time': `${COIN_MS}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
