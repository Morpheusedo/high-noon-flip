/**
 * The frame every dialog uses: a dimmed stage and a brass-edged panel.
 *
 * With `onClose`, Escape and a tap outside the panel close it. Without it the
 * dialog stays until the player picks one of its buttons, as an error must.
 * The element marked `data-autofocus` takes the focus when it opens. While it is
 * open the rest of the page is inert, so Tab and a screen reader stay inside it
 * and no control behind it can be reached.
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
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => (root.current ? holdOutside(root.current) : undefined), []);
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
      ref={root}
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

/** How many open dialogs hold each element inert: an error can open over the settings. */
const holds = new Map<HTMLElement, number>();

/** Makes everything but `dialog` and its ancestors inert; returns the undo. */
function holdOutside(dialog: HTMLElement): () => void {
  const held: HTMLElement[] = [];
  for (let el: HTMLElement | null = dialog; el && el !== document.body; el = el.parentElement)
    for (const sibling of el.parentElement?.children ?? [])
      if (sibling !== el && sibling instanceof HTMLElement) held.push(sibling);
  for (const el of held) {
    holds.set(el, (holds.get(el) ?? 0) + 1);
    el.inert = true;
  }
  return () => {
    for (const el of held) {
      const left = (holds.get(el) ?? 1) - 1;
      if (left > 0) holds.set(el, left);
      else {
        holds.delete(el);
        el.inert = false;
      }
    }
  };
}
