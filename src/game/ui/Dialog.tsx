/**
 * The frame every dialog uses: a dimmed stage and a brass-edged panel.
 *
 * With `onClose`, Escape and a tap outside the panel close it. Without it the
 * dialog stays until the player picks one of its buttons, as an error must.
 * The element marked `data-autofocus` takes the focus when it opens.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import './Dialog.css';

interface Props {
  label: string;
  /** `alertdialog` for errors: screen readers announce it at once. */
  role?: 'dialog' | 'alertdialog';
  /** Extra class on the panel, for its width and contents. */
  panelClass?: string;
  onClose?: () => void;
  children: ComponentChildren;
}

export function Dialog({ label, role = 'dialog', panelClass, onClose, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!onClose) return;
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
      class={`dialog${onClose ? ' closable' : ''}`}
      role={role}
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        if (onClose && !(e.target as HTMLElement).closest('.dialog-panel')) onClose();
      }}
    >
      <div ref={panel} class={`dialog-panel${panelClass ? ` ${panelClass}` : ''}`}>
        {children}
      </div>
    </div>
  );
}
