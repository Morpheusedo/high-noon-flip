/**
 * The top of the screen: the title sign with the last flips under it, and the
 * speed button.
 */
import type { Side } from '../../server/protocol';
import { SPEEDS, type Speed } from '../../shell/settings';
import { HISTORY_SIZE } from '../model/RoundModel';
import { useText } from './text';
import './TopBar.css';

export function TitleSign({ history }: { history: Side[] }) {
  const { t } = useText();
  return (
    <div class="sign-wrap">
      <h1 class="sign">{t('game.title')}</h1>
      <ol class="dots" aria-label={t('flips.last')}>
        {Array.from({ length: HISTORY_SIZE }, (_, i) => {
          const side = history[i];
          return side ? (
            <li class={side} title={t(`side.${side}`)} aria-label={t(`side.${side}`)} />
          ) : (
            <li aria-hidden="true" />
          );
        })}
      </ol>
    </div>
  );
}

interface SpeedButtonProps {
  speed: Speed;
  onChange(speed: Speed): void;
}

/** Cycles 1x → 2x → 4x. Not shown at all where the market bans turbo. */
export function SpeedButton({ speed, onChange }: SpeedButtonProps) {
  const { t } = useText();
  const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
  return (
    <button
      class="tool speed"
      data-speed={speed}
      aria-label={t('speed.button', { name: t(`speed.${speed}`) })}
      onClick={() => onChange(next)}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <g transform="rotate(45 12 12)">
          <path d="M12 2.5c2.8 2 4.5 5.6 4.5 9.5l-1.7 3H9.2l-1.7-3c0-3.9 1.7-7.5 4.5-9.5z" />
          <circle cx="12" cy="9.5" r="1.5" />
          <path d="M8.5 14.5l-2.5 3 3-.8M15.5 14.5l2.5 3-3-.8M12 17.5v3.5" />
        </g>
      </svg>
      <span class="tool-badge">{speed}×</span>
    </button>
  );
}
