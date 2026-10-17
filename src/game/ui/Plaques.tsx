/**
 * Wooden plaques along the bottom: the balance, the bet in the middle (− and +
 * step through the levels, the amount opens them all), the ladder above it, and
 * in a run the cash out in the bet's place, with the space bar under it.
 */
import { useLayoutEffect, useRef, type MutableRef } from 'preact/hooks';
import { nextLevel } from '../../server/bets';
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
  /** How long a win waits before it counts up, while its coins fly here. */
  delay: number;
  fmt: Formats;
}

/** Counts up when a win lands; long balances get a smaller font so they never run into the bet. */
export function Balance({ balance, demo, reducedMotion, delay, fmt }: BalanceProps) {
  const { t } = useText();
  const shown = useCountUp(balance, reducedMotion, { delay });
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
  /** The server takes typed stakes: the amount opens the field, ready to type in. */
  typed: boolean;
  disabled: boolean;
  fmt: Formats;
  onChange(bet: Minor): void;
  /** Opens every level at once. */
  onOpen(): void;
}

/**
 * The bet, in the middle at the bottom: − and + step one level, the amount opens
 * the list (and the field for an exact amount, where the server takes one).
 */
export function Stake({ bets, bet, typed, disabled, fmt, onChange, onOpen }: StakeProps) {
  const { t } = useText();
  // from a typed amount between two levels, to the level above or below it
  const lower = nextLevel(bets, bet, -1);
  const higher = nextLevel(bets, bet, 1);
  return (
    <div class="stake" role="group" aria-label={t('bet')} data-locked={disabled || undefined}>
      <button
        class="stake-step"
        aria-label={t('bet.lower')}
        disabled={disabled || lower === null}
        onClick={() => lower !== null && onChange(lower)}
      >
        <StepIcon plus={false} />
      </button>
      <button
        class="stake-value"
        aria-label={t(typed ? 'bet.changeLabelTyped' : 'bet.changeLabel', {
          amount: fmt.full(bet),
        })}
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
        disabled={disabled || higher === null}
        onClick={() => higher !== null && onChange(higher)}
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
  /** The multiplier of the rung the run stands on. */
  multiplier: number;
  /** What the next correct pick would pay; `top` when that rung pays out by itself. */
  next: { amount: Minor; top: boolean } | null;
  /** The chance that one pick wins, from the server's config; null shows none. */
  chance: number | null;
  disabled: boolean;
  reducedMotion: boolean;
  fmt: Formats;
  /** The plaque, so the coins of a cash out know where they leave from. */
  plaque: MutableRef<HTMLButtonElement | null>;
  /** Space was just pressed, so its keycap dips. */
  keyDown: boolean;
  onCashOut(): void;
}

/** How long the prize counts up to a new rung. */
const PRIZE_COUNT_MS = 400;

/**
 * The prize on the table and the next one, the player's real choice: CASH OUT and
 * the multiplier big, the amount under them, and the chance of the next flip with
 * what it would pay along the bottom. A correct pick counts the prize up and pops
 * the plaque once; between picks it stands still. The space bar keycap stands
 * beside it on a desktop.
 */
export function CashOut({
  prize,
  multiplier,
  next,
  chance,
  disabled,
  reducedMotion,
  fmt,
  plaque,
  keyDown,
  onCashOut,
}: CashOutProps) {
  const { t } = useText();
  const shown = useCountUp(prize, reducedMotion, { duration: PRIZE_COUNT_MS });
  const last = useRef(prize);
  useLayoutEffect(() => {
    const grew = prize > last.current;
    last.current = prize;
    if (!grew || reducedMotion) return;
    plaque.current?.animate([{ scale: 1 }, { scale: 1.04, offset: 0.4 }, { scale: 1 }], {
      duration: 240,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    });
  }, [prize, reducedMotion, plaque]);
  return (
    <div class="cashout-spot">
      <button class="cashout" ref={plaque} disabled={disabled} onClick={onCashOut}>
        <span class="cashout-title">{t('cashOut')}</span>
        <span class="cashout-multiplier">{fmt.multiplier(multiplier)}</span>
        <span class="cashout-amount">
          <Amount value={shown} fmt={fmt} />
        </span>
        {next && <span class="cashout-next">{nextLine(t, fmt, next, chance)}</span>}
      </button>
      <SpaceKey disabled={disabled} pressed={keyDown} onCashOut={onCashOut} />
    </div>
  );
}

function nextLine(
  t: ReturnType<typeof useText>['t'],
  fmt: Formats,
  next: { amount: Minor; top: boolean },
  chance: number | null,
): string {
  const amount = fmt.full(next.amount);
  if (chance === null) return t(next.top ? 'cashOut.nextTop' : 'cashOut.next', { amount });
  return t(next.top ? 'cashOut.chanceTop' : 'cashOut.chance', {
    chance: fmt.percent(chance),
    amount,
  });
}

function SpaceKey({
  disabled,
  pressed,
  onCashOut,
}: {
  disabled: boolean;
  /** Space was just pressed, so the keycap dips. */
  pressed: boolean;
  onCashOut(): void;
}) {
  const { t } = useText();
  return (
    <button
      class={`key space${pressed ? ' down' : ''}`}
      tabIndex={-1}
      aria-label={t('cashOut.key')}
      disabled={disabled}
      onClick={onCashOut}
    >
      <svg
        viewBox="0 0 48 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M8 9v6h32V9" />
      </svg>
    </button>
  );
}
