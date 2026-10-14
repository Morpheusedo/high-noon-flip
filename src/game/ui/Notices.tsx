/**
 * Messages over the scene: the result stamp, the insufficient-funds notice and
 * the error dialogs.
 */
import type { Minor, ServerErrorCode } from '../../server/protocol';
import type { Outcome } from '../model/RoundModel';
import { errorScreen, goToLobby, type ErrorAction } from '../../shell/errors';
import { Dialog } from './Dialog';
import type { Formats } from './format';
import { useText } from './text';
import './Notices.css';

/** An inked rubber stamp over the coin: green WIN or red LOSE, with the amount under it. */
export function ResultStamp({ outcome, fmt }: { outcome: Outcome; fmt: Formats }) {
  const { t } = useText();
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
      <b>{lost ? t('stamp.lose') : t('stamp.win')}</b>
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
  const { t } = useText();
  return (
    <div class="notice" role="alert">
      <span>{broke ? t('funds.notEnoughAtAll') : t('funds.notEnough')}</span>
      {canLower && (
        <button class="btn" onClick={onLower}>
          {t('funds.lower')}
        </button>
      )}
      <button class="btn" onClick={onClose}>
        {t('common.ok')}
      </button>
    </div>
  );
}

interface ErrorProps {
  code: ServerErrorCode;
  fatal: boolean;
  /** The operator's lobby; without it a fatal error offers only a reload. */
  lobbyUrl: string | null;
  /** Retry or continue: the model closes the error and asks the server again if it must. */
  onDismiss(): void;
}

/** A dialog per server error, with the code for support and the way out that fits it. */
export function ErrorDialog({ code, fatal, lobbyUrl, onDismiss }: ErrorProps) {
  const { t } = useText();
  const screen = errorScreen(code, fatal, lobbyUrl !== null);
  const run: Record<ErrorAction, () => void> = {
    retry: onDismiss,
    continue: onDismiss,
    lobby: () => lobbyUrl && goToLobby(lobbyUrl),
    reload: () => location.reload(),
  };
  return (
    <Dialog label={t(`error.${screen.kind}.title`)} role="alertdialog" panelClass="error-panel">
      <h2>{t(`error.${screen.kind}.title`)}</h2>
      <p>{t(`error.${screen.kind}.body`)}</p>
      <p class="dialog-note">{t('error.code', { code })}</p>
      <div class="dialog-actions">
        {screen.actions.map((action, i) => (
          <button class="btn" data-autofocus={i === 0 ? true : undefined} onClick={run[action]}>
            {t(`error.${action}`)}
          </button>
        ))}
      </div>
    </Dialog>
  );
}
