/**
 * Every bet level at once, as rows of bullets: the quick way to a far-off
 * level when the operator sends many. Opens from the bet amount.
 */
import { useEffect, useRef } from 'preact/hooks';
import type { Minor } from '../../server/protocol';
import type { Formats } from './format';
import { useText } from './text';
import './BetPicker.css';

interface Props {
  bets: Minor[];
  bet: Minor;
  fmt: Formats;
  onChoose(bet: Minor): void;
  onClose(): void;
}

export function BetPicker({ bets, bet, fmt, onChoose, onClose }: Props) {
  const { t } = useText();
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    grid.current
      ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      class="picker"
      role="dialog"
      aria-modal="true"
      aria-label={t('bet.choose')}
      // a tap outside the bullets closes it without changing the bet
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.picker-grid')) onClose();
      }}
    >
      <div class="picker-panel">
        <h2>{t('bet.choose')}</h2>
        <div class="picker-now">
          {fmt.amount(bet)} <small>{fmt.code}</small>
        </div>
        <div class="picker-grid" ref={grid}>
          {bets.map((b) => (
            <button
              class="bullet"
              aria-pressed={b === bet}
              aria-label={fmt.full(b)}
              style={{ '--len': fmt.short(b).length }}
              onClick={() => onChoose(b)}
            >
              {fmt.short(b)}
            </button>
          ))}
        </div>
        <p class="picker-hint">{t('bet.chooseHint')}</p>
      </div>
    </div>
  );
}
