/**
 * The sound button (mute), the settings button under it, and the settings it
 * opens: effects and music volumes, and the speed where the market allows turbo.
 * The settings are saved in the browser (`shell/settings.ts`).
 */
import { SPEEDS, type Speed } from '../../shell/settings';
import { Dialog } from './Dialog';
import { useText } from './text';
import './Settings.css';

const ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2.2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
} as const;

export function SoundButton({ muted, onToggle }: { muted: boolean; onToggle(): void }) {
  const { t } = useText();
  return (
    <button
      class="tool sound"
      aria-pressed={muted}
      aria-label={muted ? t('sound.unmute') : t('sound.mute')}
      onClick={onToggle}
    >
      <svg {...ICON}>
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        {muted ? (
          <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
        ) : (
          <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
        )}
      </svg>
    </button>
  );
}

export function SettingsButton({ onOpen }: { onOpen(): void }) {
  const { t } = useText();
  return (
    <button class="tool settings" aria-label={t('settings.open')} onClick={onOpen}>
      <svg {...ICON} stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    </button>
  );
}

interface PanelProps {
  sfx: number;
  music: number;
  /** Null where the market bans turbo: the speed choice is not shown. */
  speed: Speed | null;
  onSfx(volume: number): void;
  /** Called when a drag on the effects slider ends, to let the player hear the level. */
  onSfxSet(): void;
  onMusic(volume: number): void;
  onSpeed(speed: Speed): void;
  onClose(): void;
}

export function SettingsPanel(props: PanelProps) {
  const { sfx, music, speed, onSfx, onSfxSet, onMusic, onSpeed, onClose } = props;
  const { t } = useText();

  const slider = (id: string, label: string, value: number, set: (v: number) => void) => (
    <div class="settings-row">
      <label for={id}>{label}</label>
      <output for={id}>{value}</output>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onInput={(e) => set(Number((e.target as HTMLInputElement).value))}
        onChange={id === 'sfx-volume' ? onSfxSet : undefined}
      />
    </div>
  );

  return (
    <Dialog label={t('settings.title')} panelClass="settings-panel" onClose={onClose}>
      <h2>{t('settings.title')}</h2>
      {slider('sfx-volume', t('settings.effects'), sfx, onSfx)}
      {slider('music-volume', t('settings.music'), music, onMusic)}
      <p class="dialog-note">{t('settings.musicNote')}</p>
      {speed !== null && (
        <fieldset>
          <legend>{t('settings.speed')}</legend>
          <div class="speed-choice">
            {SPEEDS.map((v) => (
              <label>
                <input
                  type="radio"
                  name="speed"
                  value={v}
                  checked={v === speed}
                  onChange={() => onSpeed(v)}
                />
                <b>{v}×</b>
                <small>{t(`speed.${v}`)}</small>
              </label>
            ))}
          </div>
          <p class="dialog-note">{t('settings.speedNote')}</p>
        </fieldset>
      )}
      <button class="btn" data-autofocus onClick={onClose}>
        {t('common.close')}
      </button>
    </Dialog>
  );
}
