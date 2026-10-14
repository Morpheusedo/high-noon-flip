/**
 * The round state machine: the single source of truth for what the game is doing.
 *
 *            pick / cash out
 *   idle ──────────────────▶ requesting ──server answers──▶ revealing ──▶ result ──▶ idle
 *    ▲                           │        (cash out skips revealing)         │
 *    │                           └──server fails──▶ error ──dismiss──────────┘
 *
 * - `requesting`: the request is on its way; every control is locked.
 * - `revealing`: the server has answered and the coin is in the air. The outcome
 *   is known but not shown yet, so the balance still excludes the win.
 * - `result`: the coin has landed; the stamp shows the win or loss.
 *
 * The director (animations) calls `finishReveal()` and `finishResult()` when
 * its part is done. Anything a player does in the wrong phase is ignored, which
 * is what stops a double tap from sending two bets.
 */
import {
  ServerError,
  type Flip,
  type GameConfig,
  type GameServer,
  type InitResponse,
  type Jurisdiction,
  type Minor,
  type Mode,
  type OpenRun,
  type RoundResponse,
  type ServerErrorCode,
  type Side,
} from '../../server/protocol';
import { Store } from '../../shell/store';

/** How many past outcomes the strip under the title shows. */
export const HISTORY_SIZE = 10;

export type Outcome =
  /** Money was paid: an instant win, a cash out or the top rung. */
  | { kind: 'win'; amount: Minor }
  /** The stake is gone. */
  | { kind: 'lose'; amount: Minor }
  /** A correct pick in a multiply run: the run goes on with this prize on the table. */
  | { kind: 'step'; prize: Minor; multiplier: number };

export type Phase =
  | { name: 'idle' }
  /** `pick` is null for a cash out. */
  | { name: 'requesting'; pick: Side | null }
  | { name: 'revealing'; flip: Flip }
  | { name: 'result'; outcome: Outcome; flip: Flip | null }
  | { name: 'error'; code: ServerErrorCode; fatal: boolean };

export interface RoundState {
  phase: Phase;
  /** The balance the player should see right now. */
  balance: Minor;
  bet: Minor;
  mode: Mode;
  openRun: OpenRun | null;
  /** Past outcomes, newest first. */
  history: Side[];
  readonly config: GameConfig;
  readonly jurisdiction: Jurisdiction;
}

/**
 * Errors after which the client can no longer trust its picture of the session.
 * A server's INSUFFICIENT_FUNDS means the balance changed elsewhere (a withdrawal
 * in the lobby, a second tab), so it asks again before suggesting a lower bet.
 */
const RESYNC_AFTER: readonly ServerErrorCode[] = [
  'INSUFFICIENT_FUNDS',
  'NETWORK',
  'INTERNAL',
  'ROUND_NOT_FOUND',
  'ROUND_IN_PROGRESS',
];
const FATAL: readonly ServerErrorCode[] = ['SESSION_EXPIRED'];

/* ---------- questions the interface asks ---------- */

export const isIdle = (s: RoundState): boolean => s.phase.name === 'idle';
export const canPick = (s: RoundState): boolean =>
  isIdle(s) && (s.openRun !== null || s.balance >= s.bet);
export const canCashOut = (s: RoundState): boolean => isIdle(s) && s.openRun !== null;
/** Bet and mode are locked while a multiply run is open. */
export const canChangeSetup = (s: RoundState): boolean => isIdle(s) && s.openRun === null;
/** The highest bet the balance covers, or null when it covers none. */
export const affordableBet = (s: RoundState): Minor | null =>
  s.config.bets.filter((b) => b <= s.balance).at(-1) ?? null;

export class RoundModel {
  readonly store: Store<RoundState>;
  private readonly server: GameServer;
  /** Balance as the server last reported it, before any win that is still being revealed. */
  private confirmedBalance: Minor;
  /** The answer being revealed, applied when the coin lands. */
  private pending: { response: RoundResponse; outcome: Outcome } | null = null;

  constructor(server: GameServer, init: InitResponse) {
    this.server = server;
    this.confirmedBalance = init.balance;
    this.store = new Store<RoundState>({
      phase: { name: 'idle' },
      balance: init.balance,
      // a run left open last session comes back with its own bet and mode
      bet: init.openRun?.bet ?? init.config.defaultBet,
      mode: init.openRun ? 'multiply' : 'instant',
      openRun: init.openRun,
      history: [],
      config: init.config,
      jurisdiction: init.jurisdiction,
    });
  }

  get state(): RoundState {
    return this.store.get();
  }

  /* ---------- player actions ---------- */

  async pick(side: Side): Promise<void> {
    const s = this.state;
    if (!isIdle(s)) return;
    const run = s.openRun;
    if (!run && s.balance < s.bet) {
      this.update({ phase: { name: 'error', code: 'INSUFFICIENT_FUNDS', fatal: false } });
      return;
    }

    // a new round shows the stake leaving the balance at once; a run already paid it
    this.update({
      phase: { name: 'requesting', pick: side },
      balance: run ? s.balance : s.balance - s.bet,
    });
    const stake = run ? run.bet : s.bet;
    await this.send(
      () =>
        run
          ? this.server.action({ roundId: run.roundId, type: 'pick', pick: side })
          : this.server.play({ mode: s.mode, bet: s.bet, pick: side }),
      stake,
    );
  }

  async cashOut(): Promise<void> {
    const s = this.state;
    const run = s.openRun;
    if (!canCashOut(s) || !run) return;
    this.update({ phase: { name: 'requesting', pick: null } });
    await this.send(() => this.server.action({ roundId: run.roundId, type: 'cashout' }), run.bet);
  }

  setBet(bet: Minor): void {
    if (!canChangeSetup(this.state) || !this.state.config.bets.includes(bet)) return;
    this.update({ bet });
  }

  setMode(mode: Mode): void {
    if (!canChangeSetup(this.state)) return;
    this.update({ mode });
  }

  /** Closes the error. After an error that may have left things out of step, asks the server again. */
  async dismissError(): Promise<void> {
    const { phase } = this.state;
    if (phase.name !== 'error' || phase.fatal) return;
    if (!RESYNC_AFTER.includes(phase.code)) {
      this.update({ phase: { name: 'idle' }, balance: this.confirmedBalance });
      return;
    }
    await this.resync();
  }

  /**
   * Asks the server again for the balance and any open run, between rounds only.
   * For a balance that changed outside the game: a deposit the operator reports,
   * or QA changing the test server.
   */
  async refresh(): Promise<void> {
    if (!isIdle(this.state)) return;
    await this.resync();
  }

  /* ---------- called by the director ---------- */

  /** The coin has landed. */
  finishReveal(): void {
    const s = this.state;
    const pending = this.pending;
    if (s.phase.name !== 'revealing' || !pending) return;
    this.showResult(pending.response, pending.outcome, s.phase.flip);
  }

  /** The result has been shown long enough; back to idle. */
  finishResult(): void {
    if (this.state.phase.name !== 'result') return;
    this.update({ phase: { name: 'idle' } });
  }

  /* ---------- internals ---------- */

  /** Locks the controls while it fetches the session again, as on a fresh load. */
  private async resync(): Promise<void> {
    this.update({ phase: { name: 'requesting', pick: null } });
    try {
      const init = await this.server.init();
      this.confirmedBalance = init.balance;
      this.update({
        phase: { name: 'idle' },
        balance: init.balance,
        openRun: init.openRun,
        ...(init.openRun ? { mode: 'multiply' as const, bet: init.openRun.bet } : {}),
      });
    } catch (err) {
      this.fail(err);
    }
  }

  private async send(request: () => Promise<RoundResponse>, stake: Minor): Promise<void> {
    let response: RoundResponse;
    try {
      response = await request();
    } catch (err) {
      this.fail(err);
      return;
    }
    this.confirmedBalance = response.balance;
    const outcome = outcomeOf(response, stake, this.state.config);
    if (response.flip) {
      this.pending = { response, outcome };
      this.update({ phase: { name: 'revealing', flip: response.flip } });
    } else {
      this.showResult(response, outcome, null);
    }
  }

  private showResult(response: RoundResponse, outcome: Outcome, flip: Flip | null): void {
    this.pending = null;
    const history = flip
      ? [flip.outcome, ...this.state.history].slice(0, HISTORY_SIZE)
      : this.state.history;
    this.update({
      phase: { name: 'result', outcome, flip },
      balance: response.balance,
      openRun: response.openRun,
      history,
    });
  }

  private fail(err: unknown): void {
    const code = err instanceof ServerError ? err.code : 'INTERNAL';
    if (!(err instanceof ServerError)) console.error(err);
    this.pending = null;
    this.update({
      phase: { name: 'error', code, fatal: FATAL.includes(code) },
      balance: this.confirmedBalance,
    });
  }

  private update(patch: Partial<RoundState>): void {
    this.store.set({ ...this.state, ...patch });
  }
}

function outcomeOf(response: RoundResponse, stake: Minor, config: GameConfig): Outcome {
  if (response.win > 0) return { kind: 'win', amount: response.win };
  const run = response.openRun;
  if (run) return { kind: 'step', prize: run.prize, multiplier: config.ladder[run.step - 1] ?? 0 };
  return { kind: 'lose', amount: stake };
}
