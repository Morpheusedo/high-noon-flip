/**
 * A stand-in for the provider's RGS that runs in the browser.
 *
 * It follows the same rules a real server would: it validates every request,
 * takes the stake before flipping, keeps an open multiply run across reloads
 * and answers with the new balance. It also implements `QaServer`, so QA and
 * the debug panel can force outcomes and errors, slow the network or open a
 * run at any rung.
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
import { isValidBet } from './bets';
import type { FailurePoint, ForcedFlip, QaServer, QaSnapshot } from './qa';
import { readJson, writeJson, type KeyValueStore } from '../shell/storage';

export type { KeyValueStore };

/** Payouts in hundredths, so the math stays in whole numbers. 198 = x1.98.
 * Each correct pick doubles the prize; every rung keeps the 99% return. */
const LADDER_HUNDREDTHS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => 198 * 2 ** i);

const DEFAULT_CONFIG: GameConfig = {
  currency: { code: 'FUN', decimals: 2 },
  bets: [100, 500, 1000, 2500, 5000, 10000],
  defaultBet: 100,
  // typed stakes for the demo: 0.10 to 100.00 in steps of 0.05
  customBet: { min: 10, max: 10_000, step: 5 },
  ladder: LADDER_HUNDREDTHS.map((h) => h / 100),
  rtp: 0.99,
  // a fair coin
  winChance: 0.5,
};

const DEFAULT_JURISDICTION: Jurisdiction = {
  turboAllowed: true,
  minRoundMs: 0,
  showSessionClock: false,
};

interface SavedState {
  balance: Minor;
  openRun: OpenRun | null;
}

export interface MockServerOptions {
  balance?: Minor;
  config?: Partial<GameConfig>;
  jurisdiction?: Partial<Jurisdiction>;
  /** Where the session is kept between reloads. Without it every load starts fresh. */
  store?: KeyValueStore | null;
  storeKey?: string;
  /** Simulated network delay per request, in milliseconds. */
  latencyMs?: number;
  /** Source of coin flips; a fair crypto-random flip by default. */
  flip?: () => Side;
}

export class MockServer implements GameServer, QaServer {
  private readonly config: GameConfig;
  private readonly jurisdiction: Jurisdiction;
  private readonly store: KeyValueStore | null | undefined;
  private readonly storeKey: string;
  private readonly startBalance: Minor;
  private readonly flipCoin: () => Side;
  private readonly listeners = new Set<() => void>();

  private state: SavedState;
  private latencyMs: number;
  private forced: ForcedFlip[] = [];
  private failure: QaSnapshot['failure'] = null;
  private offline = false;

  constructor(options: MockServerOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.jurisdiction = { ...DEFAULT_JURISDICTION, ...options.jurisdiction };
    this.store = options.store;
    this.storeKey = options.storeKey ?? 'hnf.mock-server';
    this.startBalance = options.balance ?? 100_000;
    this.latencyMs = options.latencyMs ?? 0;
    this.flipCoin = options.flip ?? fairFlip;
    this.state = this.load() ?? { balance: this.startBalance, openRun: null };
  }

  /* ---------- QaServer ---------- */

  snapshot(): QaSnapshot {
    return clone({
      balance: this.state.balance,
      openRun: this.state.openRun,
      forced: this.forced,
      failure: this.failure,
      offline: this.offline,
      latencyMs: this.latencyMs,
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The next flips land like this, in order, instead of at random. */
  forceOutcomes(...flips: ForcedFlip[]): void {
    this.forced.push(...flips);
    this.changed();
  }

  clearForced(): void {
    this.forced = [];
    this.changed();
  }

  failNext(code: ServerErrorCode | null, at: FailurePoint = 'before'): void {
    this.failure = code ? { code, at } : null;
    this.changed();
  }

  setOffline(offline: boolean): void {
    this.offline = offline;
    this.changed();
  }

  setLatency(ms: number): void {
    this.latencyMs = Math.max(0, ms);
    this.changed();
  }

  setBalance(balance: Minor): void {
    if (!Number.isSafeInteger(balance) || balance < 0) {
      throw new RangeError(`Balance must be whole minor units, got ${balance}`);
    }
    this.state.balance = balance;
    this.save();
  }

  openRunAt(step: number, bet: Minor): void {
    // the top rung is never an open run: it pays out by itself
    if (!Number.isInteger(step) || step < 1 || step >= LADDER_HUNDREDTHS.length) {
      throw new RangeError(`A run can stay open at steps 1 to ${LADDER_HUNDREDTHS.length - 1}`);
    }
    const open = this.state.openRun;
    if (open) {
      this.state.openRun = { ...open, step, prize: rungPrize(open.bet, step) };
    } else {
      if (!isValidBet(this.config, bet)) throw new ServerError('INVALID_BET');
      if (bet > this.state.balance) throw new ServerError('INSUFFICIENT_FUNDS');
      this.state.balance -= bet;
      this.state.openRun = { roundId: newRoundId(), bet, step, prize: rungPrize(bet, step) };
    }
    this.save();
  }

  reset(): void {
    this.state = { balance: this.startBalance, openRun: null };
    this.forced = [];
    this.failure = null;
    this.offline = false;
    this.save();
  }

  /* ---------- GameServer ---------- */

  async init(): Promise<InitResponse> {
    await this.respond();
    return this.answer({
      balance: this.state.balance,
      config: this.config,
      jurisdiction: this.jurisdiction,
      openRun: this.state.openRun,
    });
  }

  async play(request: PlayRequest): Promise<RoundResponse> {
    await this.respond();
    if (this.state.openRun) throw new ServerError('ROUND_IN_PROGRESS');
    if (!isValidBet(this.config, request.bet)) throw new ServerError('INVALID_BET');
    if (request.bet > this.state.balance) throw new ServerError('INSUFFICIENT_FUNDS');

    const roundId = newRoundId();
    this.state.balance -= request.bet;
    const flip = this.flip(request.pick);

    const openRun: OpenRun | null = flip.won
      ? { roundId, bet: request.bet, step: 1, prize: rungPrize(request.bet, 1) }
      : null;
    return this.finish({ roundId, flip, win: 0, openRun });
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
    return this.answer({ ...result, balance: this.state.balance });
  }

  private flip(pick: Side): Flip {
    const forced = this.forced.shift();
    const outcome =
      forced === 'win' ? pick : forced === 'lose' ? other(pick) : (forced ?? this.flipCoin());
    return { pick, outcome, won: outcome === pick };
  }

  /** Waits for the simulated network, then fails if QA asked for it. */
  private async respond(): Promise<void> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    if (this.offline) throw new ServerError('NETWORK');
    if (this.failure?.at === 'before') this.throwFailure(this.failure.code);
  }

  /** The answer on its way back: lost if QA asked for it, after the server has settled. */
  private answer<T>(value: T): T {
    if (this.failure?.at === 'after') this.throwFailure(this.failure.code);
    return clone(value);
  }

  private throwFailure(code: ServerErrorCode): never {
    this.failure = null;
    this.changed();
    throw new ServerError(code);
  }

  private load(): SavedState | null {
    return readJson(this.store, this.storeKey) as SavedState | null;
  }

  /** Every change to the session goes through here, so the QA panel hears of it. */
  private save(): void {
    writeJson(this.store, this.storeKey, this.state);
    this.changed();
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
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

function other(side: Side): Side {
  return side === 'sheriff' ? 'outlaw' : 'sheriff';
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
