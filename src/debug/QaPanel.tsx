/**
 * The QA panel: a drawer at the left edge of the page, outside the stage, so it
 * never moves the game's layout. The QA tab or the ` key opens it.
 *
 * Every control changes the test server, not the client. Where the client
 * would not notice by itself, the panel asks the model to `refresh()`, the
 * same resync a deposit in the lobby causes, so what the screen shows has
 * always come from a server answer.
 *
 * QA reads this panel in English: it is a tool, not part of the game, so its
 * labels are not in the player's dictionaries.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Minor, ServerErrorCode } from '../server/protocol';
import type { FailurePoint, ForcedFlip, QaServer, QaSnapshot } from '../server/qa';
import { betLimits } from '../server/bets';
import { toMinor } from '../shell/money';
import { readJson, writeJson, type KeyValueStore } from '../shell/storage';
import { useStore } from '../shell/useStore';
import { isIdle, type RoundModel, type RoundState } from '../game/model/RoundModel';
import { formats, type Formats } from '../game/ui/format';
import './QaPanel.css';

interface Props {
  server: QaServer;
  model: RoundModel;
  lang: string;
  /** Remembers whether the drawer was open. */
  storage: KeyValueStore | null;
}

const OPEN_KEY = 'hnf.qa-open';

const FLIPS: readonly { flip: ForcedFlip; label: string }[] = [
  { flip: 'sheriff', label: 'Sheriff' },
  { flip: 'outlaw', label: 'Outlaw' },
  { flip: 'win', label: 'Win' },
  { flip: 'lose', label: 'Lose' },
];

/** Every code, with what it checks. A Record, so a new code in the protocol is a type error here. */
const ERRORS: Record<ServerErrorCode, string> = {
  NETWORK: 'connection lost: Try again, resync',
  SESSION_EXPIRED: 'fatal: lobby or reload',
  INSUFFICIENT_FUNDS: 'balance changed elsewhere: resync, lower bet',
  INVALID_BET: 'bet refused: Continue, no resync',
  ROUND_IN_PROGRESS: 'a run is open on the server: resync',
  ROUND_NOT_FOUND: 'the run was settled: resync',
  INTERNAL: 'server fault: resync',
};
const CODES = Object.keys(ERRORS) as ServerErrorCode[];

const LATENCIES = [0, 150, 500, 1500, 5000];

export function QaPanel({ server, model, lang, storage }: Props) {
  const s = useStore(model.store);
  const snap = useSnapshot(server);
  const [open, setOpen] = useState(() => readJson(storage, OPEN_KEY) === true);
  const [note, setNote] = useState('');
  const [code, setCode] = useState<ServerErrorCode>('NETWORK');
  const [amount, setAmount] = useState('');
  const [tell, setTell] = useState(true);
  const [step, setStep] = useState(1);
  const fmt = useMemo(() => formats(s.config.currency, lang), [s.config.currency, lang]);
  const idle = isIdle(s);
  const lastStep = s.config.ladder.length - 1;

  useEffect(() => writeJson(storage, OPEN_KEY, open), [storage, open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // by position, so it is the same key on a Russian layout, where it types "ё"
      const backquote = e.code === 'Backquote' || e.key === '`';
      if (!backquote || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    // capture: the panel stops keys inside it from bubbling to the game
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  /** Runs a server change and reports what happened or why it was refused. */
  const act = (done: string, change: () => void, refresh = false) => {
    try {
      change();
    } catch (err) {
      setNote(`Refused: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    setNote(done);
    if (refresh) void model.refresh();
  };

  const setBalance = (minor: Minor | null) => {
    if (minor === null) {
      setNote(`Not an amount: use up to ${s.config.currency.decimals} decimals`);
      return;
    }
    act(
      `Server balance set to ${fmt.full(minor)}${tell ? '' : '; the screen learns on the next bet'}`,
      () => server.setBalance(minor),
      tell,
    );
  };

  const lowest = betLimits(s.config).min;

  return (
    <div class="qa" data-open={open || undefined} onKeyDown={(e) => e.stopPropagation()}>
      <button
        class="qa-tab"
        aria-expanded={open}
        aria-controls="qa-panel"
        title="QA panel (` key)"
        onClick={() => setOpen(!open)}
      >
        QA
      </button>
      <aside id="qa-panel" class="qa-panel" aria-label="QA panel" hidden={!open}>
        <header>
          <h2>QA · demo only</h2>
          <button aria-label="Close the QA panel" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>

        <Status s={s} snap={snap} fmt={fmt} />

        <section>
          <h3>Next flips</h3>
          <div class="qa-row">
            {FLIPS.map(({ flip, label }) => (
              <button onClick={() => act(`Queued: ${label}`, () => server.forceOutcomes(flip))}>
                {label}
              </button>
            ))}
          </div>
          <p class="qa-queue">
            {snap.forced.length ? snap.forced.map(flipLabel).join(' → ') : 'random'}
            {snap.forced.length > 0 && (
              <button
                class="qa-link"
                onClick={() => act('Queue cleared', () => server.clearForced())}
              >
                clear
              </button>
            )}
          </p>
        </section>

        <section>
          <h3>Errors</h3>
          <select
            aria-label="Error code"
            value={code}
            onChange={(e) => setCode((e.target as HTMLSelectElement).value as ServerErrorCode)}
          >
            {CODES.map((c) => (
              <option value={c}>{c}</option>
            ))}
          </select>
          <p class="qa-hint">{ERRORS[code]}</p>
          <div class="qa-row">
            {(['before', 'after'] as FailurePoint[]).map((at) => (
              <button
                onClick={() =>
                  act(`Armed: ${code} ${pointLabel(at)}`, () => server.failNext(code, at))
                }
              >
                {at === 'before' ? 'Fail next request' : 'Lose next answer'}
              </button>
            ))}
          </div>
          <p class="qa-hint">
            Fail: the request changes nothing. Lose: the server settles it, then the answer is lost,
            as when the connection drops mid-round.
          </p>
          {snap.failure && (
            <p class="qa-queue">
              Armed: {snap.failure.code} {pointLabel(snap.failure.at)}
              <button class="qa-link" onClick={() => act('Disarmed', () => server.failNext(null))}>
                disarm
              </button>
            </p>
          )}
          <label class="qa-check">
            <input
              type="checkbox"
              checked={snap.offline}
              onChange={(e) => {
                const on = (e.target as HTMLInputElement).checked;
                act(on ? 'Offline: every request fails' : 'Back online', () =>
                  server.setOffline(on),
                );
              }}
            />
            Offline (every request fails with NETWORK)
          </label>
          <label class="qa-field">
            Latency
            <select
              value={snap.latencyMs}
              onChange={(e) => {
                const ms = Number((e.target as HTMLSelectElement).value);
                act(`Latency ${ms} ms`, () => server.setLatency(ms));
              }}
            >
              {LATENCIES.map((ms) => (
                <option value={ms}>{ms} ms</option>
              ))}
            </select>
          </label>
        </section>

        <section>
          <h3>Balance</h3>
          <form
            class="qa-row"
            onSubmit={(e) => {
              e.preventDefault();
              setBalance(toMinor(amount, s.config.currency));
            }}
          >
            <input
              aria-label={`Balance in ${fmt.code}`}
              inputMode="decimal"
              placeholder={fmt.amount(snap.balance)}
              value={amount}
              onInput={(e) => setAmount((e.target as HTMLInputElement).value)}
            />
            <button disabled={tell && !idle}>Set</button>
          </form>
          <div class="qa-row">
            <button disabled={tell && !idle} onClick={() => setBalance(0)}>
              0
            </button>
            <button disabled={tell && !idle} onClick={() => setBalance(Math.max(0, lowest - 1))}>
              Below lowest bet
            </button>
            <button disabled={tell && !idle} onClick={() => setBalance(Math.max(0, s.bet - 1))}>
              Below this bet
            </button>
          </div>
          <label class="qa-check">
            <input
              type="checkbox"
              checked={tell}
              onChange={(e) => setTell((e.target as HTMLInputElement).checked)}
            />
            Update the screen now (off: the next bet finds out from the server)
          </label>
        </section>

        <section>
          <h3>Multiply run</h3>
          <div class="qa-row">
            <select
              aria-label="Correct picks"
              value={step}
              onChange={(e) => setStep(Number((e.target as HTMLSelectElement).value))}
            >
              {s.config.ladder.slice(0, lastStep).map((m, i) => (
                <option value={i + 1}>
                  {i + 1} correct · {fmt.exactMultiplier(m)}
                </option>
              ))}
            </select>
            <button
              disabled={!idle}
              onClick={() =>
                act(
                  snap.openRun
                    ? `Run moved to step ${step}`
                    : `Run opened at step ${step}, stake ${fmt.full(s.bet)}`,
                  () => server.openRunAt(step, s.bet),
                  true,
                )
              }
            >
              {snap.openRun ? 'Move run' : 'Open run'}
            </button>
          </div>
          <p class="qa-hint">
            A new run stakes the current bet. Step {lastStep} is the last open rung; the next win
            pays the top.
          </p>
        </section>

        <section>
          <h3>Session</h3>
          <div class="qa-row">
            <button
              onClick={() => {
                server.reset();
                location.reload();
              }}
            >
              Reset session
            </button>
            <button onClick={() => location.reload()}>Reload</button>
          </div>
          <p class="qa-hint">Reset: starting balance, no run, nothing forced. Settings stay.</p>
        </section>

        <p class="qa-note" role="status">
          {note}
        </p>
      </aside>
    </div>
  );
}

function Status({ s, snap, fmt }: { s: RoundState; snap: QaSnapshot; fmt: Formats }) {
  const { phase } = s;
  const run = snap.openRun;
  const multiplier = run ? s.config.ladder[run.step - 1] : undefined;
  return (
    <dl class="qa-status">
      <dt>Phase</dt>
      <dd>
        {phase.name}
        {phase.name === 'error' && ` · ${phase.code}`}
      </dd>
      <dt>Server balance</dt>
      <dd>{fmt.full(snap.balance)}</dd>
      <dt>On screen</dt>
      <dd class={s.balance === snap.balance ? undefined : 'qa-differs'}>{fmt.full(s.balance)}</dd>
      <dt>Open run</dt>
      <dd>
        {run && multiplier !== undefined
          ? `step ${run.step} · ${fmt.exactMultiplier(multiplier)} · ${fmt.full(run.prize)}`
          : 'none'}
      </dd>
      {run && (
        <>
          <dt>Round</dt>
          <dd title={run.roundId}>{run.roundId.slice(0, 8)}</dd>
        </>
      )}
    </dl>
  );
}

function useSnapshot(server: QaServer): QaSnapshot {
  const [snap, setSnap] = useState(() => server.snapshot());
  useEffect(() => {
    setSnap(server.snapshot());
    return server.subscribe(() => setSnap(server.snapshot()));
  }, [server]);
  return snap;
}

function flipLabel(flip: ForcedFlip): string {
  return FLIPS.find((f) => f.flip === flip)?.label ?? flip;
}

function pointLabel(at: FailurePoint): string {
  return at === 'before' ? 'before the server' : 'after the server settles';
}
