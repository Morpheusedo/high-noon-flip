/**
 * The contract between the game client and the game server (RGS).
 *
 * The client never decides an outcome or computes a balance: it sends a request
 * and shows what the server answers. Today `MockServer` implements this
 * interface in the browser; later a provider adapter implements it on top of
 * the provider's SDK, and nothing else in the game changes.
 *
 * Money is always an integer amount of minor units (cents) of the session
 * currency, so payouts like 1.98x never pick up floating point errors.
 */

export type Minor = number;

export type Side = 'sheriff' | 'outlaw';

export interface Currency {
  /** ISO 4217 code, or an operator code such as FUN for play money. */
  code: string;
  /** Digits after the decimal point: 2 for EUR, 0 for JPY, 8 for BTC. */
  decimals: number;
}

/** Game settings the operator and provider choose; the client only displays them. */
export interface GameConfig {
  currency: Currency;
  /** Bet levels, ascending: what − and + step through and the bet list shows. */
  bets: Minor[];
  defaultBet: Minor;
  /**
   * Any stake from `min` to `max` on a grid of `step` (`(bet - min) % step === 0`),
   * besides the levels in `bets`: the player may type an amount. Only the RGS can
   * say it takes such stakes, so without this the game offers the levels alone.
   * `isValidBet` in `bets.ts` is the rule both sides apply.
   */
  customBet?: CustomBet | null;
  /** The prize multiplier after 1, 2, 3 ... correct picks in a row. */
  ladder: number[];
  /** Return to player, as a fraction: 0.99 is 99%. */
  rtp: number;
  /**
   * The chance that one pick wins, as the certified math has it: 0.5 for a fair coin.
   * The cash out shows it beside the next prize; absent or null, it shows no chance.
   */
  winChance?: number | null;
}

/** The range of typed stakes, in minor units of the session currency. */
export interface CustomBet {
  min: Minor;
  max: Minor;
  step: Minor;
}

/** Market rules that switch client features on or off. */
export interface Jurisdiction {
  turboAllowed: boolean;
  /** Shortest time a round may take on screen, in milliseconds. 0 means no limit. */
  minRoundMs: number;
  showSessionClock: boolean;
}

/** A multiply run that is still open: the player can pick again or cash out. */
export interface OpenRun {
  roundId: string;
  bet: Minor;
  /** Correct picks so far. */
  step: number;
  /** What a cash out would pay right now. */
  prize: Minor;
}

export interface InitResponse {
  balance: Minor;
  config: GameConfig;
  jurisdiction: Jurisdiction;
  /** Present when the player left during a multiply run: the client must resume it. */
  openRun: OpenRun | null;
}

/** Stakes `bet` and makes the first pick of a run. */
export interface PlayRequest {
  bet: Minor;
  pick: Side;
}

export type ActionRequest =
  { roundId: string; type: 'pick'; pick: Side } | { roundId: string; type: 'cashout' };

export interface Flip {
  pick: Side;
  outcome: Side;
  won: boolean;
}

export interface RoundResponse {
  roundId: string;
  /** Balance after this request, already including any win. */
  balance: Minor;
  /** The coin flip this request caused; absent for a cash out. */
  flip: Flip | null;
  /** Amount credited by this request. */
  win: Minor;
  /** The multiply run if it is still open after this request, otherwise null. */
  openRun: OpenRun | null;
}

export type ServerErrorCode =
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_BET'
  | 'ROUND_NOT_FOUND'
  | 'ROUND_IN_PROGRESS'
  | 'SESSION_EXPIRED'
  | 'NETWORK'
  | 'INTERNAL';

export class ServerError extends Error {
  readonly code: ServerErrorCode;

  constructor(code: ServerErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ServerError';
    this.code = code;
  }
}

export interface GameServer {
  init(): Promise<InitResponse>;
  /** The first pick of a multiply run. */
  play(request: PlayRequest): Promise<RoundResponse>;
  /** Next pick or cash out in an open multiply run. */
  action(request: ActionRequest): Promise<RoundResponse>;
}
