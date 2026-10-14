/**
 * The HTML interface over the canvas. For now a boot readout that proves the
 * launch → server → screen path works; the real controls move here next.
 */
import type { InitResponse } from '../../server/protocol';
import { formatMoney } from '../../shell/money';
import './app.css';

interface Props {
  init: InitResponse;
  lang: string;
}

export function App({ init, lang }: Props) {
  const { currency } = init.config;
  return (
    <div class="boot-readout">
      <h1 class="boot-title">High Noon Flip</h1>
      <p>Balance: {formatMoney(init.balance, currency, lang)}</p>
      <p>Bets: {init.config.bets.map((b) => formatMoney(b, currency, lang)).join(' · ')}</p>
      {init.openRun && <p>Open multiply run at step {init.openRun.step}</p>}
    </div>
  );
}
