/**
 * Messages over the scene: the result stamp, the insufficient-funds notice and,
 * until step 6 brings proper dialogs, a plain error notice.
 */
import type { Minor, ServerErrorCode } from '../../server/protocol';
import type { Outcome } from '../model/RoundModel';
import type { Formats } from './format';
import { text } from './text';
import './Notices.css';

/** An inked rubber stamp over the coin: green WIN or red LOSE, with the amount under it. */
export function ResultStamp({ outcome, fmt }: { outcome: Outcome; fmt: Formats }) {
  const amount = (value: Minor) => `${fmt.amount(value)} ${fmt.code}`;
  const lost = outcome.kind === 'lose';
  const line =
    outcome.kind === 'win'
      ? `+${amount(outcome.amount)}`
      : outcome.kind === 'lose'
        ? `−${amount(outcome.amount)}`
        : `${fmt.multiplier(outcome.multiplier)} · ${amount(outcome.prize)}`;
  return (
    <div class={`stamp ${lost ? 'lose' : 'win'}`} role="status">
      <b>{lost ? text.lose : text.win}</b>
      <span>{line}</span>
    </div>
  );
}

interface FundsProps {
  /** Even the lowest bet is more than the balance. */
  broke: boolean;
  /** A lower bet exists to offer. */
  canLower: boolean;
  onLower(): void;
  onClose(): void;
}

/**
 * Shown when the client stops a bet itself, and when the server refuses one
 * because the balance changed elsewhere. In the second case the client's
 * balance is out of date, so "Lower the bet" asks the server first.
 */
export function FundsNotice({ broke, canLower, onLower, onClose }: FundsProps) {
  return (
    <div class="notice" role="alert">
      <span>{broke ? text.notEnoughAtAll : text.notEnough}</span>
      {canLower && (
        <button class="btn" onClick={onLower}>
          {text.lowerBet}
        </button>
      )}
      <button class="btn" onClick={onClose}>
        {text.ok}
      </button>
    </div>
  );
}

interface ErrorProps {
  code: ServerErrorCode;
  fatal: boolean;
  onClose(): void;
}

export function ErrorNotice({ code, fatal, onClose }: ErrorProps) {
  return (
    <div class="notice" role="alert">
      <span>{text.error(code)}</span>
      {!fatal && (
        <button class="btn" onClick={onClose}>
          {text.ok}
        </button>
      )}
    </div>
  );
}
