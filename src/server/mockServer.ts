/**
 * A stand-in for the provider's RGS that runs in the browser.
 *
 * It follows the same rules a real server would: it validates every request,
 * takes the stake before flipping, keeps an open multiply run across reloads
 * and answers with the new balance. QA and the debug panel can queue the next
 * outcomes or make the next request fail.
 */
import {
  ServerError,
  type ActionRequest,
  type Flip,
  type GameConfig,
  type GameServer,
  type InitResponse,
  type Jurisdiction,
  type Minor,
  type OpenRun,
  type PlayRequest,
  type RoundResponse,
  type ServerErrorCode,
  type Side,
} from './protocol';

/** Payouts in hundredths, so the math stays in whole numbers. 198 = x1.98. */
const INSTANT_HUNDREDTHS = 198;
/** Each correct pick doubles the prize; every rung keeps the 99% return. */
const LADDER_HUNDREDTHS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => 198 * 2 ** i);

const DEFAULT_CONFIG: GameConfig = {
  currency: { code: 'FUN', decimals: 2 },
  bets: [100, 500, 1000, 2500, 5000, 10000],
  defaultBet: 100,
  instantMultiplier: INSTANT_HUNDREDTHS / 100,
  ladder: LADDER_HUNDREDTHS.map((h) => h / 100),
  rtp: 0.99,
};

const DEFAULT_JURISDICTION: Jurisdiction = {
  turboAllowed: true,
  minRoundMs: 0,
  showSessionClock: false,
};

/** The part of `Storage` the server needs; `localStorage` fits, tests pass a fake. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface SavedState {
  balance: Minor;
  openRun: OpenRun | null;
}

export interface MockServerOptions {
  balance?: Minor;
  config?: Partial<GameConfig>;
  jurisdiction?: Partial<Jurisdiction>;
  /** Where the session is kept between reloads. Without it every load starts fresh. */
  store?: KeyValueStore;
  storeKey?: string;
  /** Simulated network delay per request, in milliseconds. */
  latencyMs?: number;
  /** Source of coin flips; a fair crypto-random flip by default. */
  flip?: () => Side;
}

export class MockServer implements GameServer {
  private readonly config: GameConfig;
  private readonly jurisdiction: Jurisdiction;
  private readonly store: KeyValueStore | undefined;
  private readonly storeKey: string;
  private readonly latencyMs: number;
  private readonly flipCoin: () => Side;

  private state: SavedState;
  private forcedOutcomes: Side[] = [];
  private forcedError: ServerErrorCode | null = null;

  constructor(options: MockServerOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.jurisdiction = { ...DEFAULT_JURISDICTION, ...options.jurisdiction };
    this.store = options.store;
    this.storeKey = options.storeKey ?? 'hnf.mock-server';
    this.latencyMs = options.latencyMs ?? 0;
    this.flipCoin = options.flip ?? fairFlip;
    this.state = this.load() ?? { balance: options.balance ?? 100_000, openRun: null };
  }

  /* ---------- debug controls ---------- */

  /** The next flips land on these sides, in order, instead of random ones. */
  forceOutcomes(...sides: Side[]): void {
    this.forcedOutcomes.push(...sides);
  }

  /** The next request fails with this error and changes nothing. */
  failNext(code: ServerErrorCode): void {
    this.forcedError = code;
  }

  setBalance(balance: Minor): void {
    this.state.balance = balance;
    this.save();
  }

  /* ---------- GameServer ---------- */

  async init(): Promise<InitResponse> {
    await this.respond();
    return clone({
      balance: this.state.balance,
      config: this.config,
      jurisdiction: this.jurisdiction,
      openRun: this.state.openRun,
    });
  }

  async play(request: PlayRequest): Promise<RoundResponse> {
    await this.respond();
    if (this.state.openRun) throw new ServerError('ROUND_IN_PROGRESS');
    if (!this.config.bets.includes(request.bet)) throw new ServerError('INVALID_BET');
    if (request.bet > this.state.balance) throw new ServerError('INSUFFICIENT_FUNDS');

    const roundId = newRoundId();
    this.state.balance -= request.bet;
    const flip = this.flip(request.pick);

    let win = 0;
    let openRun: OpenRun | null = null;
    if (request.mode === 'instant') {
      if (flip.won) win = payout(request.bet, INSTANT_HUNDREDTHS);
    } else if (flip.won) {
      openRun = { roundId, bet: request.bet, step: 1, prize: rungPrize(request.bet, 1) };
    }
    return this.finish({ roundId, flip, win, openRun });
  }

  async action(request: ActionRequest): Promise<RoundResponse> {
    await this.respond();
    const run = this.state.openRun;
    if (!run || run.roundId !== request.roundId) throw new ServerError('ROUND_NOT_FOUND');

    if (request.type === 'cashout') {
      return this.finish({ roundId: run.roundId, flip: null, win: run.prize, openRun: null });
    }

    const flip = this.flip(request.pick);
    if (!flip.won) return this.finish({ roundId: run.roundId, flip, win: 0, openRun: null });

    const step = run.step + 1;
    const prize = rungPrize(run.bet, step);
    // the top rung pays out by itself: there is nothing left to climb
    if (step === LADDER_HUNDREDTHS.length) {
      return this.finish({ roundId: run.roundId, flip, win: prize, openRun: null });
    }
    return this.finish({ roundId: run.roundId, flip, win: 0, openRun: { ...run, step, prize } });
  }

  /* ---------- internals ---------- */

  private finish(result: Omit<RoundResponse, 'balance'>): RoundResponse {
    this.state.balance += result.win;
    this.state.openRun = result.openRun;
    this.save();
    return clone({ ...result, balance: this.state.balance });
  }

  private flip(pick: Side): Flip {
    const outcome = this.forcedOutcomes.shift() ?? this.flipCoin();
    return { pick, outcome, won: outcome === pick };
  }

  /** Waits for the simulated network, then throws a queued error if there is one. */
  private async respond(): Promise<void> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    const code = this.forcedError;
    if (code) {
      this.forcedError = null;
      throw new ServerError(code);
    }
  }

  private load(): SavedState | null {
    try {
      const raw = this.store?.getItem(this.storeKey);
      return raw ? (JSON.parse(raw) as SavedState) : null;
    } catch {
      return null;
    }
  }

  private save(): void {
    try {
      this.store?.setItem(this.storeKey, JSON.stringify(this.state));
    } catch {
      // storage can be full or blocked; the session still works for this page load
    }
  }
}

/** Win amounts round down to the minor unit, as servers do. */
function payout(bet: Minor, hundredths: number): Minor {
  return Math.floor((bet * hundredths) / 100);
}

function rungPrize(bet: Minor, step: number): Minor {
  const hundredths = LADDER_HUNDREDTHS[step - 1];
  if (hundredths === undefined) throw new ServerError('INTERNAL', `No ladder rung ${step}`);
  return payout(bet, hundredths);
}

function fairFlip(): Side {
  const byte = new Uint8Array(1);
  crypto.getRandomValues(byte);
  return (byte[0] ?? 0) & 1 ? 'sheriff' : 'outlaw';
}

function newRoundId(): string {
  return crypto.randomUUID();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
