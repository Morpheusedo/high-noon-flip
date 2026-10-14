/**
 * The HTML interface over the canvas.
 *
 * For now a plain test panel that drives the round model, so the state machine
 * can be tried in the browser. The western controls from the prototype replace
 * it piece by piece.
 */
import {
  canCashOut,
  canChangeSetup,
  canPick,
  type Outcome,
  type RoundModel,
} from '../model/RoundModel';
import type { Currency } from '../../server/protocol';
import { SPEEDS, type Settings } from '../../shell/settings';
import type { Store } from '../../shell/store';
import { formatMoney } from '../../shell/money';
import { useStore } from '../../shell/useStore';
import './app.css';

interface Props {
  model: RoundModel;
  settings: Store<Settings>;
  lang: string;
}

export function App({ model, settings, lang }: Props) {
  const s = useStore(model.store);
  const { speed } = useStore(settings);
  const turbo = s.jurisdiction.turboAllowed;
  const { currency, bets } = s.config;
  const money = (amount: number) => formatMoney(amount, currency, lang);
  const { phase } = s;

  return (
    <div class="test-panel">
      <h1 class="test-title">High Noon Flip</h1>
      <p>
        Balance <b>{money(s.balance)}</b> · Phase <code>{phase.name}</code>
      </p>
      <p class="row">
        {(['instant', 'multiply'] as const).map((m) => (
          <button
            disabled={!canChangeSetup(s)}
            aria-pressed={s.mode === m}
            onClick={() => model.setMode(m)}
          >
            {m}
          </button>
        ))}
      </p>
      <p class="row">
        {bets.map((b) => (
          <button
            disabled={!canChangeSetup(s)}
            aria-pressed={s.bet === b}
            onClick={() => model.setBet(b)}
          >
            {money(b)}
          </button>
        ))}
      </p>
      <p class="row">
        {SPEEDS.map((v) => (
          <button
            disabled={v !== 1 && !turbo}
            aria-pressed={(turbo ? speed : 1) === v}
            onClick={() => settings.set({ ...settings.get(), speed: v })}
          >
            {v}×
          </button>
        ))}
      </p>
      <p class="row">
        <button disabled={!canPick(s)} onClick={() => void model.pick('outlaw')}>
          Outlaw
        </button>
        <button disabled={!canPick(s)} onClick={() => void model.pick('sheriff')}>
          Sheriff
        </button>
        <button disabled={!canCashOut(s)} onClick={() => void model.cashOut()}>
          Cash out {s.openRun && money(s.openRun.prize)}
        </button>
      </p>
      {phase.name === 'revealing' && <p>Coin in the air…</p>}
      {phase.name === 'result' && <p class="result">{describe(phase.outcome, currency, lang)}</p>}
      {phase.name === 'error' && (
        <p class="error">
          {phase.code}{' '}
          {!phase.fatal && <button onClick={() => void model.dismissError()}>OK</button>}
        </p>
      )}
      <p class="history">Last flips: {s.history.join(' · ') || '—'}</p>
    </div>
  );
}

function describe(outcome: Outcome, currency: Currency, lang: string): string {
  const money = (a: number) => formatMoney(a, currency, lang);
  switch (outcome.kind) {
    case 'win':
      return `WIN +${money(outcome.amount)}`;
    case 'lose':
      return `LOSE −${money(outcome.amount)}`;
    case 'step':
      return `×${outcome.multiplier} · ${money(outcome.prize)} on the table`;
  }
}
