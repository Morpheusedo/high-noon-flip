/**
 * The sound button (mute), the music button under it, and the panel it opens
 * with the effects and music volumes.
 */
import { useEffect, useRef } from 'preact/hooks';
import { text } from './text';
import './SoundControls.css';

export function SoundButton({ muted, onToggle }: { muted: boolean; onToggle(): void }) {
  return (
    <button
      class="tool sound"
      aria-pressed={muted}
      aria-label={muted ? text.unmute : text.mute}
      onClick={onToggle}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
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

export function MixButton({ onOpen }: { onOpen(): void }) {
  return (
    <button class="tool mix" aria-label={text.soundLevels} onClick={onOpen}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M9 17.5V6l10-2v11.5" />
        <circle cx="6.5" cy="17.5" r="2.5" />
        <circle cx="16.5" cy="15.5" r="2.5" />
      </svg>
    </button>
  );
}

interface MixPanelProps {
  sfx: number;
  music: number;
  onSfx(volume: number): void;
  /** Called when a drag on the effects slider ends, to let the player hear the level. */
  onSfxSet(): void;
  onMusic(volume: number): void;
  onClose(): void;
}

export function MixPanel({ sfx, music, onSfx, onSfxSet, onMusic, onClose }: MixPanelProps) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const slider = (id: string, label: string, value: number, set: (v: number) => void) => (
    <div class="mix-row">
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
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-label={text.soundLevels}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.dialog-panel')) onClose();
      }}
    >
      <div class="dialog-panel mix-panel">
        <h2>{text.sound}</h2>
        {slider('sfx-volume', text.soundEffects, sfx, onSfx)}
        {slider('music-volume', text.music, music, onMusic)}
        <p class="dialog-note">{text.musicNote}</p>
        <button ref={close} class="btn" onClick={onClose}>
          {text.close}
        </button>
      </div>
    </div>
  );
}
