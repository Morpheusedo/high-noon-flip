/**
 * Every bet level at once, as rows of bullets: the quick way to a far-off
 * level when the operator sends many. Opens from the bet amount.
 *
 * When the server takes typed stakes (`customBet`), a field above the bullets
 * takes an exact amount. It reads the number as the player's language writes it
 * and checks it against the config and the balance before anything is sent; the
 * server still has the last word.
 */
import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { isValidBet, snapToGrid } from '../../server/bets';
import type { CustomBet, GameConfig, Minor } from '../../server/protocol';
import type { Formats } from './format';
import { useText } from './text';
import './BetPicker.css';

interface Props {
  config: GameConfig;
  bet: Minor;
  balance: Minor;
  fmt: Formats;
  onChoose(bet: Minor): void;
  onClose(): void;
}

export function BetPicker({ config, bet, balance, fmt, onChoose, onClose }: Props) {
  const { t } = useText();
  const grid = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const keyboard = useKeyboardInset(root);
  useEffect(() => {
    grid.current
      ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?.focus({ preventScroll: true });
    // also while typing: Escape leaves the bet as it was
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
      class="picker"
      data-keyboard={keyboard ? '' : undefined}
      style={keyboard ? { paddingTop: keyboard.top, paddingBottom: keyboard.bottom } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={t('bet.choose')}
      // a tap outside the bullets and the field closes it without changing the bet
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.picker-grid, .picker-type')) onClose();
      }}
    >
      <div class="picker-panel">
        <h2>{t('bet.choose')}</h2>
        <div class="picker-now">
          {fmt.amount(bet)} <small>{fmt.code}</small>
        </div>
        {config.customBet && (
          <TypedBet
            config={config}
            custom={config.customBet}
            balance={balance}
            fmt={fmt}
            onChoose={onChoose}
          />
        )}
        <div class="picker-grid" ref={grid}>
          {config.bets.map((b) => (
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

interface TypedProps {
  config: GameConfig;
  custom: CustomBet;
  balance: Minor;
  fmt: Formats;
  onChoose(bet: Minor): void;
}

/** The exact-amount field: "7.35 FUN [OK]", with the reason underneath when it cannot be the bet. */
function TypedBet({ config, custom, balance, fmt, onChoose }: TypedProps) {
  const { t } = useText();
  const [text, setText] = useState('');
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const field = useRef<HTMLInputElement>(null);

  const refuse = (message: string) => {
    setNote({ text: message, error: true });
    field.current?.focus();
  };

  const submit = () => {
    const amount = fmt.parse(text);
    if (amount === null || amount === 0) {
      refuse(t('bet.typed.notAmount', { example: fmt.input(custom.min) }));
      return;
    }
    const exact = isValidBet(config, amount);
    if (!exact && amount < custom.min) {
      refuse(t('bet.typed.min', { min: fmt.full(custom.min) }));
      return;
    }
    if (!exact && amount > custom.max) {
      refuse(t('bet.typed.max', { max: fmt.full(custom.max) }));
      return;
    }
    // a level is taken as it is; anything else lands on the server's grid
    const stake = exact ? amount : (snapToGrid(config, amount) ?? amount);
    if (stake > balance) {
      refuse(t('bet.typed.balance', { balance: fmt.full(balance) }));
      return;
    }
    if (stake !== amount) {
      // the player sees the stake before it is theirs, so a rounding is never silent
      setText(fmt.input(stake));
      setNote({
        text: t('bet.typed.rounded', { step: fmt.full(custom.step), amount: fmt.full(stake) }),
        error: false,
      });
      return;
    }
    onChoose(stake);
  };

  return (
    <form
      class="picker-type"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label class="picker-field" data-invalid={note?.error || undefined}>
        <input
          ref={field}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          spellcheck={false}
          placeholder={t('bet.typed.placeholder')}
          aria-label={t('bet.typed.label', { currency: fmt.code })}
          aria-invalid={note?.error || undefined}
          aria-describedby="picker-note"
          value={text}
          onInput={(e) => {
            setText(e.currentTarget.value);
            setNote(null);
          }}
        />
        <span class="picker-code" aria-hidden="true">
          {fmt.code}
        </span>
      </label>
      <button class="btn picker-ok" type="submit">
        {t('common.ok')}
      </button>
      <p id="picker-note" class="picker-note" role="status" data-error={note?.error || undefined}>
        {note?.text}
      </p>
    </form>
  );
}

/**
 * The part of the dialog a phone keyboard hides, in CSS pixels, or null with no
 * keyboard up. Phones keep the page's size under the keyboard and only shrink or
 * pan the visual viewport, so the dialog pads itself into what is still in sight.
 * Driven by the viewport alone, not by focus: a tap on OK blurs the field, and a
 * layout that moved on blur would move OK from under the finger.
 */
function useKeyboardInset(root: RefObject<HTMLElement>): { top: number; bottom: number } | null {
  const [inset, setInset] = useState<{ top: number; bottom: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = root.current;
    if (!vv || !el) return;
    const update = () => {
      // a pinch zoom shrinks the visual viewport too; only a keyboard does it at scale 1
      const box = el.getBoundingClientRect();
      const top = Math.max(0, Math.round(vv.offsetTop - box.top));
      const bottom = Math.max(0, Math.round(box.bottom - (vv.offsetTop + vv.height)));
      const hidden = Math.abs(vv.scale - 1) < 0.01 && top + bottom > box.height * 0.15;
      setInset((was) =>
        !hidden ? null : was?.top === top && was.bottom === bottom ? was : { top, bottom },
      );
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [root]);
  return inset;
}
