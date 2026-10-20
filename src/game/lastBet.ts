/**
 * The player's last bet, kept between visits so a returning player can press BET
 * at once.
 *
 * The saved bet is only a wish: the operator's config decides. A bet in another
 * currency, or one the config no longer takes (a changed list, outside the typed
 * range), gives way to the default bet, and an open run's own bet wins over it
 * (`RoundModel`). A saved value is checked field by field, as the settings are.
 */
import type { GameConfig, Minor } from '../server/protocol';
import { readJson, writeJson, type KeyValueStore } from '../shell/storage';
import { Store } from '../shell/store';

/** The last bet and the currency it was in; null before the first visit's. */
export type LastBet = { amount: Minor; currency: string } | null;

const STORE_KEY = 'hnf.bet';

/** Without `storage` the bet lasts for this page load only. */
export function createLastBet(storage?: KeyValueStore | null, key = STORE_KEY): Store<LastBet> {
  const bet = new Store<LastBet>(readLastBet(readJson(storage, key)));
  if (storage) bet.subscribe((b) => writeJson(storage, key, b));
  return bet;
}

export function readLastBet(saved: unknown): LastBet {
  const s = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {};
  return Number.isSafeInteger(s.amount) && typeof s.currency === 'string'
    ? { amount: s.amount as Minor, currency: s.currency }
    : null;
}

/** The saved bet if it was in this config's currency, for the model to check against the config. */
export function savedBet(saved: LastBet, config: GameConfig): Minor | null {
  return saved?.currency === config.currency.code ? saved.amount : null;
}

/** The last bet, now `bet`; the same value when nothing changed. */
export function withBet(saved: LastBet, bet: Minor, config: GameConfig): LastBet {
  const currency = config.currency.code;
  return saved?.amount === bet && saved.currency === currency ? saved : { amount: bet, currency };
}
