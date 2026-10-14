/**
 * Wooden plaques along the bottom: the balance, the total bet (tap to choose
 * from every level), and in a multiply run the ladder and the cash out tab.
 */
import { useRef } from 'preact/hooks';
import type { Minor } from '../../server/protocol';
import type { Formats } from './format';
import { useCountUp, useFitText } from './hooks';
import { text } from './text';
import './Plaques.css';

function Amount({ value, fmt }: { value: Minor; fmt: Formats }) {
  return (
    <>
      {fmt.amount(value)}
      <small>{fmt.code}</small>
    </>
  );
}

interface BalanceProps {
  balance: Minor;
  demo: boolean;
  reducedMotion: boolean;
  fmt: Formats;
}

/** Counts up when a win lands; long balances get a smaller font so they never run into the dial. */
export function Balance({ balance, demo, reducedMotion, fmt }: BalanceProps) {
  const shown = useCountUp(balance, reducedMotion);
  const value = useRef<HTMLSpanElement>(null);
  // fit to the final amount, so the font does not jump while it counts up
  useFitText(value, fmt.amount(balance));
  return (
    <div class="plaque balance">
      <span class="plaque-label">{demo ? text.demoBalance : text.balance}</span>
      <span class="plaque-value" ref={value}>
        <Amount value={shown} fmt={fmt} />
      </span>
    </div>
  );
}

interface BetPlaqueProps {
  bet: Minor;
  disabled: boolean;
  fmt: Formats;
  onOpen(): void;
}

export function BetPlaque({ bet, disabled, fmt, onOpen }: BetPlaqueProps) {
  return (
    <button class="plaque bet" aria-label={text.changeBet} disabled={disabled} onClick={onOpen}>
      <span class="plaque-label">
        {text.totalBet}
        <span class="chg"> · {text.change}</span>
      </span>
      <span class="plaque-value">
        <Amount value={bet} fmt={fmt} />
      </span>
    </button>
  );
}

interface LadderProps {
  ladder: number[];
  /** Correct picks so far in the run. */
  step: number;
  fmt: Formats;
}

export function Ladder({ ladder, step, fmt }: LadderProps) {
  return (
    <ol class="ladder" aria-label={text.ladder}>
      {ladder.map((m, i) => (
        <li
          class={`rung${i < step ? ' on' : i === step ? ' next' : ''}`}
          aria-current={i === step - 1 ? 'step' : undefined}
        >
          {fmt.multiplier(m)}
        </li>
      ))}
    </ol>
  );
}

interface CashOutProps {
  prize: Minor;
  disabled: boolean;
  fmt: Formats;
  onCashOut(): void;
}

export function CashOut({ prize, disabled, fmt, onCashOut }: CashOutProps) {
  return (
    <button class="cashout" disabled={disabled} onClick={onCashOut}>
      <span class="plaque-label">{text.cashOut}</span>
      <span class="plaque-value">
        <Amount value={prize} fmt={fmt} />
      </span>
    </button>
  );
}
