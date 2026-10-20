/**
 * The two choices: the Sheriff star and the Outlaw revolvers, cut from the coin
 * art, with brass keycaps under them for the arrow keys on a desktop.
 *
 * Between rounds BET comes first: until it is pressed both emblems wait, dimmed
 * and still, and a tap on one only points the player at BET. Once BET is pressed
 * they light up and take turns hopping, and a tap places the bet on that side.
 * In a run each tap flips at once. While a round plays they slide out of the way.
 *
 * An invisible button over the coin lets the player turn it over by hand. That
 * is for looks only: the server still decides every flip.
 */
import type { Side } from '../../server/protocol';
import { useText } from './text';
import './Emblems.css';

interface Props {
  disabled: boolean;
  /** The arrow key just pressed, so its keycap dips. */
  pressed: Side | null;
  /** BET is not pressed yet: dimmed and still, a tap points at BET instead. */
  waiting: boolean;
  onPick(side: Side): void;
}

export function Emblems({ disabled, pressed, waiting, onPick }: Props) {
  const { t } = useText();
  const wait = waiting ? ' waiting' : '';
  return (
    <>
      {(['outlaw', 'sheriff'] as const).map((side) => (
        <button
          class={`pick ${side}${wait}`}
          aria-label={t(`side.${side}`)}
          disabled={disabled}
          onClick={() => onPick(side)}
        />
      ))}
      {(['outlaw', 'sheriff'] as const).map((side) => (
        <button
          class={`key ${side}${pressed === side ? ' down' : ''}${wait}`}
          tabIndex={-1}
          aria-label={t(`pick.key.${side}`)}
          disabled={disabled}
          onClick={() => onPick(side)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            {side === 'outlaw' ? (
              <path d="M19 12H5M11 6l-6 6 6 6" />
            ) : (
              <path d="M5 12h14M13 6l6 6-6 6" />
            )}
          </svg>
        </button>
      ))}
    </>
  );
}

export function CoinTap({ disabled, onTap }: { disabled: boolean; onTap(): void }) {
  const { t } = useText();
  return (
    <button class="coin-tap" aria-label={t('coin.turn')} disabled={disabled} onClick={onTap} />
  );
}

/**
 * "Choose a side" between the emblems once BET is pressed, with an arrow towards
 * each. For a new player only; the emblems' hop says it to everyone. The live
 * region stays mounted so a screen reader hears the text arrive.
 */
export function SideHint({ shown }: { shown: boolean }) {
  const { t } = useText();
  return (
    <div class="side-hint" role="status">
      {shown && (
        <span>
          <Chevron dir="left" />
          {t('hint.side')}
          <Chevron dir="right" />
        </span>
      )}
    </div>
  );
}

/** A pointer for the hints: an inline SVG, so no font has to have the glyph. */
export function Chevron({ dir }: { dir: 'left' | 'right' | 'down' }) {
  const d = { left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', down: 'M5 9l7 7 7-7' }[dir];
  return (
    <svg
      class={`chevron ${dir}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
