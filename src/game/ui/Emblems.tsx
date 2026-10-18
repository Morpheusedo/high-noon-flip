/**
 * The two choices: the Sheriff star and the Outlaw revolvers, cut from the coin
 * art, with brass keycaps under them for the arrow keys on a desktop.
 *
 * Between rounds a tap only chooses a side: the chosen emblem stands raised and
 * lit, the other dims, and BET places the bet. With no side chosen yet they take
 * turns hopping, and BET without one makes both pulse once. In a run each tap
 * flips at once, so both are live and neither dims. While a round plays they
 * slide out of the way.
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
  /** The side BET will bet on; null shows them both waiting for a choice. */
  chosen: Side | null;
  /** A tap chooses a side for BET (between rounds), rather than flipping (in a run). */
  choosing: boolean;
  /** Counts BETs pressed with no side chosen: each one pulses both emblems once. */
  nudge: number;
  onPick(side: Side): void;
}

export function Emblems({ disabled, pressed, chosen, choosing, nudge, onPick }: Props) {
  const { t } = useText();
  const shown = choosing ? chosen : null;
  // two names for one pulse, so a second BET restarts it
  const nudged = choosing && !chosen && nudge > 0 ? ` nudge-${nudge % 2 ? 'a' : 'b'}` : '';
  return (
    <>
      {(['outlaw', 'sheriff'] as const).map((side) => (
        <button
          class={`pick ${side}${shown ? (shown === side ? ' chosen' : ' other') : ''}${nudged}`}
          aria-label={t(`side.${side}`)}
          aria-pressed={choosing ? chosen === side : undefined}
          disabled={disabled}
          onClick={() => onPick(side)}
        />
      ))}
      {(['outlaw', 'sheriff'] as const).map((side) => (
        <button
          class={`key ${side}${pressed === side ? ' down' : ''}`}
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
 * "Choose Sheriff or Outlaw first", between the emblems, after BET with no side
 * chosen. The live region stays mounted so a screen reader hears the text arrive.
 */
export function SideHint({ shown }: { shown: boolean }) {
  const { t } = useText();
  return (
    <div class="side-hint" role="status">
      {shown && <span>{t('bet.chooseSide')}</span>}
    </div>
  );
}
