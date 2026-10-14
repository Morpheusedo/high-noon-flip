/**
 * What the QA panel can ask of a test server. The panel never touches the
 * client's state: it changes the server, and the client finds out the way it
 * would in production, from the next answer or a resync.
 *
 * `MockServer` implements this today. A provider's staging RGS usually has its
 * own cheat API (forced outcomes, a wallet top-up); an adapter can implement
 * this interface on top of it, and the panel stays as it is. A production
 * server never offers it.
 */
import type { Minor, OpenRun, ServerErrorCode, Side } from './protocol';

/** A forced flip: a side, or a win or loss against whatever the player picks. */
export type ForcedFlip = Side | 'win' | 'lose';

/**
 * `before`: the request fails and changes nothing.
 * `after`: the server settles the request, then the answer is lost on the way back.
 */
export type FailurePoint = 'before' | 'after';

export interface QaSnapshot {
  /** The balance on the server, which the screen may not show yet. */
  balance: Minor;
  openRun: OpenRun | null;
  /** Flips waiting to be used, next first. */
  forced: readonly ForcedFlip[];
  failure: { code: ServerErrorCode; at: FailurePoint } | null;
  /** Every request fails with NETWORK while this is on. */
  offline: boolean;
  latencyMs: number;
}

export interface QaServer {
  snapshot(): QaSnapshot;
  /** Calls `listener` after any change to the snapshot; returns a function that stops it. */
  subscribe(listener: () => void): () => void;

  forceOutcomes(...flips: ForcedFlip[]): void;
  clearForced(): void;
  /** The next request fails with `code`; null disarms it. */
  failNext(code: ServerErrorCode | null, at?: FailurePoint): void;
  setOffline(offline: boolean): void;
  setLatency(ms: number): void;
  setBalance(balance: Minor): void;
  /**
   * Opens a multiply run at `step` correct picks, as if the player had won them.
   * A new run takes `bet` from the balance; an open run keeps its own bet.
   */
  openRunAt(step: number, bet: Minor): void;
  /** The session as on a first visit: the starting balance, no run, nothing forced. */
  reset(): void;
}

export function isQaServer(server: object): server is QaServer {
  return 'snapshot' in server && 'forceOutcomes' in server && 'openRunAt' in server;
}
