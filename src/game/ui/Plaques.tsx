/**
 * Wooden plaques along the bottom: the balance, the bet in the middle (− and +
 * step through the levels, the amount opens them all), the ladder above it, and
 * in a run the cash out in the bet's place.
 */
import { useRef } from 'preact/hooks';
import type { Minor } from '../../server/protocol';
import type { Formats } from './format';
import { useCountUp, useFitText } from './hooks';
import { useText } from './text';
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

/** Counts up when a win lands; long balances get a smaller font so they never run into the bet. */
export function Balance({ balance, demo, reducedMotion, fmt }: BalanceProps) {
  const { t } = useText();
  const shown = useCountUp(balance, reducedMotion);
  const value = useRef<HTMLSpanElement>(null);
  // fit to the final amount, so the font does not jump while it counts up
  useFitText(value, fmt.amount(balance));
  return (
    <div class="plaque balance">
      <span class="plaque-label">{demo ? t('balance.demo') : t('balance')}</span>
      <span class="plaque-value" ref={value}>
        <Amount value={shown} fmt={fmt} />
      </span>
    </div>
  );
}

interface StakeProps {
  bets: Minor[];
  bet: Minor;
  disabled: boolean;
  fmt: Formats;
  onChange(bet: Minor): void;
  /** Opens every level at once. */
  onOpen(): void;
}

/** The bet, in the middle at the bottom: − and + step one level, the amount opens the list. */
export function Stake({ bets, bet, disabled, fmt, onChange, onOpen }: StakeProps) {
  const { t } = useText();
  const index = bets.indexOf(bet);
  const step = (dir: 1 | -1) => {
    const next = bets[index + dir];
    if (next !== undefined) onChange(next);
  };
  return (
    <div class="stake" role="group" aria-label={t('bet')} data-locked={disabled || undefined}>
      <button
        class="stake-step"
        aria-label={t('bet.lower')}
        disabled={disabled || index <= 0}
        onClick={() => step(-1)}
      >
        <StepIcon plus={false} />
      </button>
      <button
        class="stake-value"
        aria-label={t('bet.changeLabel', { amount: fmt.full(bet) })}
        disabled={disabled}
        onClick={onOpen}
      >
        <span class="plaque-label">{t('bet')}</span>
        <span class="plaque-value">
          <Amount value={bet} fmt={fmt} />
        </span>
      </button>
      <button
        class="stake-step"
        aria-label={t('bet.raise')}
        disabled={disabled || index < 0 || index >= bets.length - 1}
        onClick={() => step(1)}
      >
        <StepIcon plus />
      </button>
    </div>
  );
}

function StepIcon({ plus }: { plus: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3.2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d={plus ? 'M5 12h14M12 5v14' : 'M5 12h14'} />
    </svg>
  );
}

interface LadderProps {
  ladder: number[];
  /** Correct picks so far in the run. */
  step: number;
  fmt: Formats;
}

export function Ladder({ ladder, step, fmt }: LadderProps) {
  const { t } = useText();
  return (
    <ol class="ladder" aria-label={t('ladder')}>
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
  const { t } = useText();
  return (
    <button class="cashout" disabled={disabled} onClick={onCashOut}>
      <span class="plaque-label">{t('cashOut')}</span>
      <span class="plaque-value">
        <Amount value={prize} fmt={fmt} />
      </span>
    </button>
  );
}
