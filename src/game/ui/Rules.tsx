/**
 * The info button and the rules screen. Every figure on it (payouts, ladder,
 * bets, RTP, maximum win) comes from the server's config through `rulesFacts`,
 * so the rules always match the math the server runs.
 */
import { useMemo } from 'preact/hooks';
import type { GameConfig, Jurisdiction, Minor } from '../../server/protocol';
import { rulesFacts } from '../rules';
import { Dialog } from './Dialog';
import type { Formats } from './format';
import { useText } from './text';
import './Rules.css';

export function RulesButton({ onOpen }: { onOpen(): void }) {
  const { t } = useText();
  return (
    <button class="tool rules" aria-label={t('rules.open')} onClick={onOpen}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.2v.1" />
      </svg>
    </button>
  );
}

interface Props {
  config: GameConfig;
  jurisdiction: Jurisdiction;
  /** The current bet, for the prize column of the ladder. */
  bet: Minor;
  demo: boolean;
  lang: string;
  fmt: Formats;
  onClose(): void;
}

export function Rules({ config, jurisdiction, bet, demo, lang, fmt, onClose }: Props) {
  const { t, parts } = useText();
  const facts = useMemo(() => rulesFacts(config, bet), [config, bet]);
  const percent = useMemo(
    () => new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 2 }),
    [lang],
  );
  const top = facts.ladder.at(-1);
  const custom = facts.customBet;
  // typed amounts that span every level say all there is to say about the limits
  const typedOnly = custom?.min === facts.minBet && custom.max === facts.maxBet;

  return (
    <Dialog label={t('rules.title')} panelClass="rules-panel" onClose={onClose}>
      <h2>{t('rules.title')}</h2>
      <div class="rules-body" tabIndex={0}>
        <h3>{t('rules.play.title')}</h3>
        <p>
          {parts('rules.play.body', {
            sheriff: <b>{t('side.sheriff')}</b>,
            outlaw: <b>{t('side.outlaw')}</b>,
          })}
        </p>

        <h3>{t('ladder')}</h3>
        <p>{parts('rules.multiply.body', { cashOut: <b>{t('cashOut')}</b> })}</p>
        <table class="rules-ladder">
          <thead>
            <tr>
              <th scope="col">{t('rules.ladder.picks')}</th>
              <th scope="col">{t('rules.ladder.pays')}</th>
              <th scope="col">{t('rules.ladder.prize', { bet: fmt.full(bet) })}</th>
            </tr>
          </thead>
          <tbody>
            {facts.ladder.map((rung) => (
              <tr>
                <td>{rung.picks}</td>
                <td>{fmt.exactMultiplier(rung.multiplier)}</td>
                <td>{fmt.full(rung.prize)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {top && <p>{t('rules.multiply.top', { count: top.picks })}</p>}

        <h3>{t('rules.odds.title')}</h3>
        <p>{parts('rules.odds.body', { rtp: <b>{percent.format(facts.rtp)}</b> })}</p>

        <h3>{t('rules.limits.title')}</h3>
        <p>
          {typedOnly
            ? ''
            : `${t('rules.limits.bets', { min: fmt.full(facts.minBet), max: fmt.full(facts.maxBet) })} `}
          {custom &&
            `${t('rules.limits.typed', {
              min: fmt.full(custom.min),
              max: fmt.full(custom.max),
              step: fmt.full(custom.step),
            })} `}
          {parts('rules.limits.maxWin', {
            multiplier: <b>{fmt.exactMultiplier(facts.maxWin.multiplier)}</b>,
            amount: <b>{fmt.full(facts.maxWin.amount)}</b>,
          })}
        </p>

        <h3>{t('rules.more.title')}</h3>
        <p>{t('rules.more.coin')}</p>
        {jurisdiction.turboAllowed && <p>{t('rules.more.speed')}</p>}
        <p>{t('rules.more.keys')}</p>
        <p>{t('rules.more.connection')}</p>

        <p class="rules-legal">{t('rules.malfunction')}</p>
        {demo && <p class="dialog-note">{t('rules.demo')}</p>}
        <p class="dialog-note">
          {t('rules.version', { version: __APP_VERSION__, build: __BUILD_HASH__ })}
        </p>
      </div>
      <button class="btn" data-autofocus onClick={onClose}>
        {t('common.close')}
      </button>
    </Dialog>
  );
}
