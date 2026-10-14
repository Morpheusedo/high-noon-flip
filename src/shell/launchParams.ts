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
}

export function readLaunchParams(search: string = location.search): LaunchParams {
  const q = new URLSearchParams(search);
  const mode: PlayMode = q.get('mode') === 'real' ? 'real' : 'demo';
  return {
    token: q.get('token') ?? '',
    lang: safeLang(q.get('lang')),
    mode,
    lobbyUrl: safeHttpUrl(q.get('lobbyUrl')),
    debug: mode === 'demo' && q.get('debug') === '1',
  };
}

function safeLang(value: string | null): string {
  if (!value) return 'en';
  try {
    return Intl.getCanonicalLocales(value)[0] ?? 'en';
  } catch {
    return 'en';
  }
}

/** Only http(s) links: a "javascript:" lobby URL would run code when the player taps home. */
function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
