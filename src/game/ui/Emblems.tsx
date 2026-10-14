/**
 * The two choices: the Sheriff star and the Outlaw revolvers, cut from the coin
 * art. They take turns hopping while the game waits for a pick, with brass
 * keycaps under them for the arrow keys on a desktop. While a round plays they
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
  onPick(side: Side): void;
}

export function Emblems({ disabled, pressed, onPick }: Props) {
  const { t } = useText();
  return (
    <>
      {(['outlaw', 'sheriff'] as const).map((side) => (
        <button
          class={`pick ${side}`}
          aria-label={t(`side.${side}`)}
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
