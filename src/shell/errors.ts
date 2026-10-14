/**
 * What the player sees for each server error, and the way out of it. Shared by
 * every game: the codes come from the server contract, not from a game.
 *
 * INSUFFICIENT_FUNDS is not here: it is part of play, and each game offers its
 * own way out (this one offers a lower bet).
 */
import type { ServerErrorCode } from '../server/protocol';

/**
 * - `retry` / `continue`: close the dialog; the model asks the server again where needed.
 * - `lobby`: leave for the operator's lobby.
 * - `reload`: start the game again.
 */
export type ErrorAction = 'retry' | 'continue' | 'lobby' | 'reload';

/** Names the title and body texts: `error.<kind>.title`, `error.<kind>.body`. */
export type ErrorKind =
  'network' | 'session' | 'roundInProgress' | 'roundNotFound' | 'invalidBet' | 'internal';

export interface ErrorScreen {
  kind: ErrorKind;
  /** The first action is the main one and takes the focus. */
  actions: ErrorAction[];
}

const KIND: Record<Exclude<ServerErrorCode, 'INSUFFICIENT_FUNDS'>, ErrorKind> = {
  NETWORK: 'network',
  SESSION_EXPIRED: 'session',
  ROUND_IN_PROGRESS: 'roundInProgress',
  ROUND_NOT_FOUND: 'roundNotFound',
  INVALID_BET: 'invalidBet',
  INTERNAL: 'internal',
};

/**
 * @param fatal the session cannot go on: the only ways out are the lobby or a reload.
 * @param hasLobby the operator gave a lobby URL.
 */
export function errorScreen(code: ServerErrorCode, fatal: boolean, hasLobby: boolean): ErrorScreen {
  // an unknown code from a newer server reads as a general error
  const kind: ErrorKind = code === 'INSUFFICIENT_FUNDS' ? 'internal' : (KIND[code] ?? 'internal');
  if (fatal) return { kind, actions: hasLobby ? ['lobby', 'reload'] : ['reload'] };
  return { kind, actions: [kind === 'network' ? 'retry' : 'continue'] };
}

/**
 * Leaves for the lobby. Inside the operator's iframe that means the top window;
 * a cross-origin parent may refuse, and then the game's own frame goes there.
 * The operator's postMessage API, when the provider names one, replaces this.
 */
export function goToLobby(url: string): void {
  try {
    if (window.top && window.top !== window) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // the parent does not allow top navigation
  }
  window.location.href = url;
}
