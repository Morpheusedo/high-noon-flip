/**
 * The tab over the dial's chosen chamber: the bet with its currency, its pointer
 * on the chamber. No word on it: BET is the button beside it, and the pointer and
 * the bullets already say this is the bet; a screen reader still hears "Bet".
 *
 * When the server takes typed stakes (`customBet`), one tap turns the tab itself
 * into a field, in place: it widens out of the tab with the bet selected, so the
 * player types over it, and a phone raises its keyboard from that same tap. Enter
 * or ✓ checks the amount (`checkTypedBet`) and sets it, the lowest or the highest
 * stake for an amount out of range; Escape or a tap anywhere else leaves the bet
 * as it was, and the field shrinks back into the tab. Without typed stakes the
 * tap opens every level (`BetPicker`).
 */
import type { RefObject } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { CustomBet, GameConfig, Minor } from '../../server/protocol';
import type { Formats } from './format';
import { useKeyboardLift, useReducedMotion } from './hooks';
import { useText } from './text';
import { checkTypedBet } from './typedBet';

interface Props {
  config: GameConfig;
  bet: Minor;
  balance: Minor;
  disabled: boolean;
  fmt: Formats;
  /** Without typed stakes: opens every level. */
  onOpen(): void;
  /** The field opened (true, called inside the tap's own handler) or closed (false). */
  onTyping(on: boolean): void;
  onChoose(bet: Minor): void;
}

type Mode = 'tab' | 'typing' | 'leaving';

export function BetTab({ config, bet, balance, disabled, fmt, onOpen, onTyping, onChoose }: Props) {
  const { t } = useText();
  const reduced = useReducedMotion();
  const spot = useRef<HTMLDivElement>(null);
  const tab = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<Mode>('tab');
  // where the tab stood, so the field grows out of it and shrinks back into it
  const from = useRef<DOMRect | null>(null);
  const refocus = useRef(false);
  const custom = config.customBet;

  const open = (e: MouseEvent) => {
    if (!custom) {
      onOpen();
      return;
    }
    from.current = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMode('typing');
    onTyping(true);
  };
  const done = (stake: Minor | null, focusTab: boolean) => {
    if (mode !== 'typing') return;
    refocus.current = focusTab;
    setMode('leaving');
    onTyping(false);
    if (stake !== null) onChoose(stake);
  };

  // a round that starts some other way takes the field away
  useEffect(() => {
    if (!disabled || mode !== 'typing') return;
    setMode('leaving');
    onTyping(false);
  }, [disabled, mode, onTyping]);

  // Enter, ✓ and Escape give the focus back to the tab, so a keyboard player keeps
  // their place; a tap elsewhere leaves it where the tap put it
  useLayoutEffect(() => {
    if (mode !== 'tab' || !refocus.current) return;
    refocus.current = false;
    tab.current?.focus({ preventScroll: true });
  }, [mode]);

  const amount = fmt.full(bet);
  return (
    <div ref={spot} class="dial-spot" data-typing={mode !== 'tab' || undefined}>
      {mode === 'tab' || !custom ? (
        <button
          ref={tab}
          class="dial-tab"
          aria-label={t(custom ? 'bet.changeLabelTyped' : 'bet.changeLabel', { amount })}
          disabled={disabled}
          onClick={open}
        >
          <span class="plaque-value">
            {fmt.amount(bet)}
            <small>{fmt.code}</small>
          </span>
        </button>
      ) : (
        <TypedField
          config={config}
          custom={custom}
          bet={bet}
          balance={balance}
          fmt={fmt}
          spot={spot}
          from={from.current}
          reduced={reduced}
          leaving={mode === 'leaving'}
          onDone={done}
          onGone={() => setMode('tab')}
        />
      )}
    </div>
  );
}

interface FieldProps {
  config: GameConfig;
  custom: CustomBet;
  /** Shown in the field to begin with, selected: typing replaces it. */
  bet: Minor;
  balance: Minor;
  fmt: Formats;
  /** The field's wrapper, which the keyboard lift does not move. */
  spot: RefObject<HTMLElement>;
  from: DOMRect | null;
  reduced: boolean;
  /** Closed: shrinking back into the tab, then `onGone`. */
  leaving: boolean;
  onDone(stake: Minor | null, refocus: boolean): void;
  onGone(): void;
}

/** Clear of the keyboard's edge when lifted, in CSS pixels. */
const LIFT_MARGIN = 10;

/** "[ 7.35 FUN ] ✓" in the tab's place, with the reason above it when it cannot be the bet. */
function TypedField(p: FieldProps) {
  const { config, custom, balance, fmt, from, reduced, leaving, onDone, onGone } = p;
  const { t } = useText();
  const [text, setText] = useState(() => fmt.input(p.bet));
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const lift = useKeyboardLift(p.spot, LIFT_MARGIN);

  // in the same commit as the mount: the stand-in the opening tap focused hands the
  // keyboard over to the field (see `App`)
  useLayoutEffect(() => {
    const input = field.current;
    if (!input || !form.current) return;
    input.focus({ preventScroll: true });
    // typing replaces the bet; setSelectionRange, since iOS ignores select() here
    input.setSelectionRange(0, input.value.length);
    morph(form.current, from, reduced, false);
    // once, on mount
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const anim = form.current ? morph(form.current, from, reduced, true) : null;
    if (anim) anim.finished.then(onGone, onGone);
    else onGone();
    // once, when it closes
  }, [leaving]);

  // a tap anywhere else leaves the bet as it was. Read on the press: the drum, an
  // emblem or the settings then go on to do what the tap was for
  useEffect(() => {
    if (leaving) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && form.current?.contains(e.target)) return;
      onDone(null, false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [leaving, onDone]);

  const refuse = (message: string) => {
    setNote({ text: message, error: true });
    field.current?.focus();
  };

  const submit = () => {
    // the field itself, not the state: an Enter right after a keystroke may beat the render
    const check = checkTypedBet(config, balance, fmt.parse(field.current?.value ?? text));
    switch (check.kind) {
      case 'bet':
        // out of range it is already the lowest or the highest stake, shown in the tab
        onDone(check.stake, true);
        return;
      case 'rounded':
        // the player sees the stake before it is theirs, so a rounding is never silent
        setText(fmt.input(check.stake));
        setNote({
          text: t('bet.typed.rounded', {
            step: fmt.full(custom.step),
            amount: fmt.full(check.stake),
          }),
          error: false,
        });
        return;
      case 'notAmount':
        refuse(t('bet.typed.notAmount', { example: fmt.input(custom.min) }));
        return;
      case 'balance':
        refuse(t('bet.typed.balance', { balance: fmt.full(balance) }));
        return;
    }
  };

  return (
    <form
      ref={form}
      class="dial-edit"
      noValidate
      data-leaving={leaving || undefined}
      data-lifted={lift > 0 || undefined}
      style={lift > 0 ? { translate: `0 ${-lift}px` } : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (!leaving) submit();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        onDone(null, true);
      }}
    >
      <label class="dial-field" data-invalid={note?.error || undefined}>
        <input
          ref={field}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          spellcheck={false}
          aria-label={t('bet.typed.label', { currency: fmt.code })}
          aria-invalid={note?.error || undefined}
          aria-describedby="dial-note"
          value={text}
          // the line grows with the amount, from 4 to 9 characters
          style={{ '--chars': Math.max(4, Math.min(9, text.length)) }}
          onInput={(e) => {
            setText(e.currentTarget.value);
            setNote(null);
          }}
        />
        <span class="dial-code" aria-hidden="true">
          {fmt.code}
        </span>
      </label>
      <button
        class="dial-ok"
        type="submit"
        aria-label={t('bet.typed.ok')}
        // the field keeps the focus, so a phone keeps its keyboard and nothing moves
        // from under the finger before the click
        onPointerDown={(e) => e.preventDefault()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 12.5l5 5 10-11" />
        </svg>
      </button>
      <p id="dial-note" class="dial-note" role="status" data-error={note?.error || undefined}>
        {note?.text}
      </p>
    </form>
  );
}

const MORPH_MS = 200;

/**
 * Grows the field out of the tab's box (`back`: shrinks it back), with its contents
 * fading in once it is wide enough to hold them. Transform and opacity only; with
 * reduced motion, opacity alone.
 */
function morph(el: HTMLElement, from: DOMRect | null, reduced: boolean, back: boolean) {
  if (typeof el.animate !== 'function') return null;
  const timing: KeyframeAnimationOptions = {
    duration: back ? MORPH_MS * 0.8 : MORPH_MS,
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    direction: back ? 'reverse' : 'normal',
    fill: 'both',
  };
  if (reduced || !from) return el.animate({ opacity: [0, 1] }, timing);
  for (const child of el.children) {
    (child as HTMLElement).animate({ opacity: [0, 0, 1], offset: [0, 0.35, 1] }, timing);
  }
  const to = el.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const tab = `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  return el.animate({ transform: [tab, 'none'] }, timing);
}
