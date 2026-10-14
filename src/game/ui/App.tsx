/**
 * The HTML interface over the canvas.
 *
 * It reads the round state and the player's settings and calls model methods;
 * it never changes the state itself. Which controls work in which phase comes
 * from the model's questions (`canChangeSetup`, `canCashOut`...), and the CSS
 * hides or dims the rest from the `data-*` attributes on the root.
 *
 * Keys: ← Outlaw, → Sheriff, ↑ ↓ bet. A held key does not repeat: one press is
 * one bet, so a key held down can never act as autoplay.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Minor, Side } from '../../server/protocol';
import type { Settings } from '../../shell/settings';
import type { Store } from '../../shell/store';
import { useStore } from '../../shell/useStore';
import {
  affordableBet,
  canCashOut,
  canChangeSetup,
  isIdle,
  type RoundModel,
} from '../model/RoundModel';
import { BetDial } from './BetDial';
import { BetPicker } from './BetPicker';
import { CoinTap, Emblems } from './Emblems';
import { formats } from './format';
import { useReducedMotion } from './hooks';
import { ErrorNotice, FundsNotice, ResultStamp } from './Notices';
import { Balance, BetPlaque, CashOut, Ladder } from './Plaques';
import { ModeSwitch, SpeedButton, TitleSign } from './TopBar';
import './app.css';

interface Props {
  model: RoundModel;
  settings: Store<Settings>;
  lang: string;
  /** Play money: the balance plaque says so. */
  demo: boolean;
  /** Turns the coin over by hand, for looks. */
  onTurnCoin(): void;
}

/** How long a keycap stays down after its arrow key. */
const KEY_DIP_MS = 110;

export function App({ model, settings, lang, demo, onTurnCoin }: Props) {
  const s = useStore(model.store);
  const { speed } = useStore(settings);
  const reducedMotion = useReducedMotion();
  const [picking, setPicking] = useState(false);
  const [pressed, setPressed] = useState<Side | null>(null);
  const fmt = useMemo(() => formats(s.config.currency, lang), [s.config.currency, lang]);

  const { phase, config, openRun } = s;
  const idle = isIdle(s);
  const setupOpen = canChangeSetup(s);
  const step = openRun?.step ?? 0;
  const hud = useRef<HTMLDivElement>(null);
  // back to the plaque that opened it, so a keyboard player keeps their place
  const closePicker = useCallback(() => {
    setPicking(false);
    hud.current?.querySelector<HTMLElement>('.plaque.bet')?.focus({ preventScroll: true });
  }, []);

  const changeBet = (bet: Minor) => model.setBet(bet);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (picking || target?.closest('input, textarea, select')) return;
      const state = model.state;
      const side = e.key === 'ArrowLeft' ? 'outlaw' : e.key === 'ArrowRight' ? 'sheriff' : null;
      if (side) {
        e.preventDefault();
        setPressed(side);
        setTimeout(() => setPressed(null), KEY_DIP_MS);
        void model.pick(side);
        return;
      }
      const dir = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
      if (dir && canChangeSetup(state)) {
        e.preventDefault();
        const { bets } = state.config;
        const next = bets[bets.indexOf(state.bet) + dir];
        if (next !== undefined) model.setBet(next);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [model, picking]);

  // the bet list closes by itself if a round starts some other way, e.g. a key
  useEffect(() => {
    if (!setupOpen) setPicking(false);
  }, [setupOpen]);

  const outcome = phase.name === 'result' ? phase.outcome.kind : undefined;
  const lower = affordableBet(s);

  return (
    <div
      ref={hud}
      class="hud"
      data-phase={phase.name}
      data-mode={s.mode}
      data-run={openRun ? 'live' : undefined}
      data-outcome={outcome === 'lose' ? 'lose' : outcome ? 'win' : undefined}
    >
      <TitleSign history={s.history} />
      <ModeSwitch mode={s.mode} disabled={!setupOpen} onChange={(m) => model.setMode(m)} />
      {s.jurisdiction.turboAllowed && (
        <SpeedButton
          speed={speed}
          onChange={(v) => settings.set({ ...settings.get(), speed: v })}
        />
      )}

      <CoinTap disabled={!idle} onTap={onTurnCoin} />
      <Emblems disabled={!idle} pressed={pressed} onPick={(side) => void model.pick(side)} />

      <Balance balance={s.balance} demo={demo} reducedMotion={reducedMotion} fmt={fmt} />
      <BetPlaque bet={s.bet} disabled={!setupOpen} fmt={fmt} onOpen={() => setPicking(true)} />
      {s.mode === 'multiply' && <Ladder ladder={config.ladder} step={step} fmt={fmt} />}
      {openRun ? (
        <CashOut
          prize={openRun.prize}
          disabled={!canCashOut(s)}
          fmt={fmt}
          onCashOut={() => void model.cashOut()}
        />
      ) : (
        <BetDial
          bets={config.bets}
          bet={s.bet}
          disabled={!setupOpen}
          label={fmt.full}
          short={fmt.short}
          onChange={changeBet}
        />
      )}

      {phase.name === 'result' && <ResultStamp outcome={phase.outcome} fmt={fmt} />}
      {phase.name === 'error' &&
        (phase.code === 'INSUFFICIENT_FUNDS' ? (
          <FundsNotice
            broke={lower === null}
            canLower={lower !== null && s.bet > (config.bets[0] ?? s.bet)}
            onLower={async () => {
              // the balance is fetched again first, so the bet goes to what it really covers
              await model.dismissError();
              const bet = affordableBet(model.state);
              if (bet !== null && bet < model.state.bet) model.setBet(bet);
            }}
            onClose={() => void model.dismissError()}
          />
        ) : (
          <ErrorNotice
            code={phase.code}
            fatal={phase.fatal}
            onClose={() => void model.dismissError()}
          />
        ))}

      {picking && (
        <BetPicker
          bets={config.bets}
          bet={s.bet}
          fmt={fmt}
          onChoose={(bet) => {
            changeBet(bet);
            closePicker();
          }}
          onClose={closePicker}
        />
      )}
    </div>
  );
}
