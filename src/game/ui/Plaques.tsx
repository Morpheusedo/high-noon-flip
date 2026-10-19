/**
 * Wooden plaques: the balance, the gold BET button in the middle at the bottom,
 * and in a run the cash out in its place. BET and the cash out each have the
 * space bar beside them. The bet itself is the cylinder dial (`BetDial`); the
 * ladder of rungs hangs under the title sign.
 */
import { Fragment } from 'preact';
import { useLayoutEffect, useRef, type MutableRef } from 'preact/hooks';
import type { Minor, Side } from '../../server/protocol';
import type { Formats } from './format';
import { useCountUp, useFitLadder, useFitText } from './hooks';
import { ladderWindow } from './ladderFit';
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

interface BetButtonProps {
  bet: Minor;
  /** The side chosen on the emblems; without one BET asks for it and sends nothing. */
  side: Side | null;
  disabled: boolean;
  fmt: Formats;
  /** Space or Enter was just pressed, so its keycap dips. */
  keyDown: boolean;
  onBet(): void;
}

/** The main action between rounds: places the bet on the side chosen on the emblems. */
export function BetButton({ bet, side, disabled, fmt, keyDown, onBet }: BetButtonProps) {
  const { t } = useText();
  const amount = fmt.full(bet);
  return (
    <div class="bet-spot">
      <button
        class="bet-button"
        aria-label={t(side ? `bet.place.${side}` : 'bet.place.none', { amount })}
        disabled={disabled}
        onClick={onBet}
      >
        {t('bet.place')}
      </button>
      <SpaceKey label={t('bet.place.key')} disabled={disabled} pressed={keyDown} onPress={onBet} />
    </div>
  );
}

interface LadderProps {
  ladder: number[];
  /** Correct picks so far in the run. */
  step: number;
  fmt: Formats;
}

/**
 * The rungs in a row. Where even small rungs do not fit (a tiny portrait screen)
 * the row shows a window of them that slides as the run climbs, with the top rung
 * after an ellipsis; a screen reader still gets every rung.
 */
export function Ladder({ ladder, step, fmt }: LadderProps) {
  const { t } = useText();
  const list = useRef<HTMLOListElement>(null);
  const size = useFitLadder(list, ladder.join(' '), step);
  const view = ladderWindow(ladder.length, step, size);
  return (
    <ol class="ladder" ref={list} aria-label={t('ladder')}>
      {ladder.map((m, i) => (
        <Fragment key={i}>
          {i === ladder.length - 1 && (
            <li class={`rung-gap${view.ellipsis ? ' shown' : ''}`} aria-hidden="true">
              …
            </li>
          )}
          <li
            class={`rung${i < step ? ' on' : i === step ? ' next' : ''}${view.shown[i] ? '' : ' out'}`}
            aria-current={i === step - 1 ? 'step' : undefined}
          >
            {/* in portrait only the next rung shows its "×", so the numbers have room;
                the others keep it for a screen reader */}
            <span class="rung-x">×</span>
            {fmt.factor(m)}
          </li>
        </Fragment>
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
      <SpaceKey
        label={t('cashOut.key')}
        disabled={disabled}
        pressed={keyDown}
        onPress={onCashOut}
      />
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
  label,
  disabled,
  pressed,
  onPress,
}: {
  label: string;
  disabled: boolean;
  /** Space was just pressed, so the keycap dips. */
  pressed: boolean;
  onPress(): void;
}) {
  return (
    <button
      class={`key space${pressed ? ' down' : ''}`}
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
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
