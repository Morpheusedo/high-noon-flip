/**
 * What the operator tells the game when it opens it.
 *
 * A casino lobby starts the game with a URL such as
 *   index.html?token=abc&lang=ru&mode=real&lobbyUrl=https://casino.example/lobby
 * Everything here is untrusted input from the address bar, so each value is
 * checked and falls back to a safe default.
 */

export type PlayMode = 'demo' | 'real';

export interface LaunchParams {
  /** Session token the server checks; empty in demo mode. */
  token: string;
  /** BCP 47 language tag, e.g. "en" or "pt-BR". */
  lang: string;
  mode: PlayMode;
  /** Where the home button sends the player; null hides the button. */
  lobbyUrl: string | null;
  /** Shows the QA panel. Never enabled in a real-money session. */
  debug: boolean;
  /**
   * QA, with `debug` only, how the test server takes stakes: its levels alone, no typed
   * stakes (`bets=levels`), or typed stakes up to 10,000,000.00 in steps of 0.01 with a
   * balance to match (`bets=wide`), for amounts too long for a chamber of the dial.
   */
  qaBets: 'levels' | 'wide' | null;
}

export function readLaunchParams(search: string = location.search): LaunchParams {
  const q = new URLSearchParams(search);
  const mode: PlayMode = q.get('mode') === 'real' ? 'real' : 'demo';
  const debug = mode === 'demo' && q.get('debug') === '1';
  return {
    token: q.get('token') ?? '',
    lang: safeLang(q.get('lang')),
    mode,
    lobbyUrl: safeHttpsUrl(q.get('lobbyUrl')),
    debug,
    qaBets: debug ? qaBets(q.get('bets')) : null,
  };
}

function qaBets(value: string | null): LaunchParams['qaBets'] {
  return value === 'levels' || value === 'wide' ? value : null;
}

function safeLang(value: string | null): string {
  if (!value) return 'en';
  try {
    return Intl.getCanonicalLocales(value)[0] ?? 'en';
  } catch {
    return 'en';
  }
}

/**
 * Only https links: a "javascript:" lobby URL would run code when the player taps
 * home, and a plain http one could be changed on the way. Which hosts may be a
 * lobby is the operator's list, checked once the provider's launch contract names it.
 */
function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
