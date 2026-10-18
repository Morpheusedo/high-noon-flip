/**
 * The HTML interface over the canvas.
 *
 * It reads the round state and the player's settings and calls model methods;
 * it never changes the state itself. Which controls work in which phase comes
 * from the model's questions (`canChangeSetup`, `canCashOut`...), and the CSS
 * hides or dims the rest from the `data-*` attributes on the root.
 *
 * A round starts in two steps: a tap on an emblem (or ← →) chooses the side, and
 * BET places the bet on it. The side stays chosen for the next round. It lives
 * here, not in the model: the server only hears of it with the bet. In a run a
 * tap on a side flips at once, as the run is a string of quick decisions.
 *
 * Keys: ← Outlaw, → Sheriff, ↑ ↓ bet, Space or Enter BET (cash out in a run). A
 * held key does not repeat: one press is one bet, so a key held down can never
 * act as autoplay.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { nextLevel } from '../../server/bets';
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
import { nextPrize } from '../rules';
import type { UiSounds } from '../sound';
import { BetPicker } from './BetPicker';
import { CoinTap, Emblems, SideHint } from './Emblems';
import { formats } from './format';
import { useReducedMotion } from './hooks';
import { ErrorDialog, FundsNotice, ResultStamp } from './Notices';
import { PAYOUT_FLIGHT_MS, Payout, type Point } from './Payout';
import { Balance, BetButton, CashOut, Ladder, Stake } from './Plaques';
import { Rules, RulesButton } from './Rules';
import { SettingsButton, SettingsPanel, SoundButton } from './Settings';
import { SpeedButton, TitleSign } from './TopBar';
import './app.css';

interface Props {
  model: RoundModel;
  settings: Store<Settings>;
  lang: string;
  /** Play money: the balance plaque and the rules say so. */
  demo: boolean;
  /** The operator's lobby, offered when the session cannot go on. */
  lobbyUrl: string | null;
  sounds: UiSounds;
  /** Turns the coin over by hand, for looks. */
  onTurnCoin(): void;
}

/** How long a keycap stays down after its key. */
const KEY_DIP_MS = 110;

type Box = Point & { width: number; height: number };

interface Flight {
  id: number;
  from: Box;
  to: Point;
}

/** `el`'s middle and size in the interface's own pixels. */
function boxIn(hud: HTMLElement, el: Element): Box {
  const h = hud.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2 - h.left,
    y: r.top + r.height / 2 - h.top,
    width: r.width,
    height: r.height,
  };
}

/** At most one panel is open over the game; each returns the focus to the button that opened it. */
type Panel = 'bets' | 'settings' | 'rules';
const OPENER: Record<Panel, string> = {
  bets: '.stake-value',
  settings: '.tool.settings',
  rules: '.tool.rules',
};

export function App({ model, settings, lang, demo, lobbyUrl, sounds, onTurnCoin }: Props) {
  const s = useStore(model.store);
  const prefs = useStore(settings);
  const { speed } = prefs;
  const [panel, setPanel] = useState<Panel | null>(null);
  const reducedMotion = useReducedMotion();
  const [pressed, setPressed] = useState<Side | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  // the side BET bets on, kept for the next round; null until the player chooses one
  const [chosen, setChosen] = useState<Side | null>(null);
  // BET with no side: the hint shows until one is chosen, and each press pulses the emblems
  const [nudge, setNudge] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);
  const fmt = useMemo(() => formats(s.config.currency, lang), [s.config.currency, lang]);

  const { phase, config, openRun } = s;
  const idle = isIdle(s);
  const setupOpen = canChangeSetup(s);
  const step = openRun?.step ?? 0;
  const hud = useRef<HTMLDivElement>(null);
  const standIn = useRef<HTMLInputElement>(null);
  const open = (p: Panel) => {
    sounds.click();
    // iOS raises the keyboard only for a focus inside the tap's own handler, and the
    // bet field mounts after it: a stand-in field takes the focus now, the keyboard
    // comes up, and the real field takes the focus (and the keyboard) over on mount
    if (p === 'bets' && config.customBet) standIn.current?.focus({ preventScroll: true });
    setPanel(p);
  };
  // back to the button that opened it, so a keyboard player keeps their place
  const close = useCallback(
    (quiet = false) => {
      if (!quiet) sounds.click();
      if (panel)
        hud.current?.querySelector<HTMLElement>(OPENER[panel])?.focus({ preventScroll: true });
      setPanel(null);
    },
    [sounds, panel],
  );
  const closePanel = useCallback(() => close(), [close]);
  const set = (patch: Partial<typeof prefs>) => settings.set({ ...settings.get(), ...patch });

  const changeBet = (bet: Minor) => model.setBet(bet);

  // where the cash out plaque stood last, for the coins of a payout: it is gone by
  // the time the answer arrives. Measured on each rung and again on the press.
  const plaque = useRef<HTMLButtonElement>(null);
  const lastPlaque = useRef<Box | null>(null);
  const notePlaque = useCallback(() => {
    if (hud.current && plaque.current) lastPlaque.current = boxIn(hud.current, plaque.current);
  }, []);
  useLayoutEffect(notePlaque, [notePlaque, openRun]);
  const cashOut = useCallback(() => {
    notePlaque();
    void model.cashOut();
  }, [model, notePlaque]);

  const chosenNow = useRef(chosen);
  chosenNow.current = chosen;
  /** BET: the bet on the chosen side, or a hint and a pulse when there is none. */
  const placeBet = useCallback(() => {
    if (!canChangeSetup(model.state)) return;
    const side = chosenNow.current;
    if (side) {
      void model.pick(side);
      return;
    }
    sounds.click();
    setNudge((n) => n + 1);
  }, [model, sounds]);
  /** An emblem or an arrow: between rounds it chooses the side, in a run it flips. */
  const onSide = useCallback(
    (side: Side) => {
      const state = model.state;
      if (!isIdle(state)) return;
      setChosen(side);
      setNudge(0);
      if (state.openRun) void model.pick(side);
      else if (chosenNow.current !== side) sounds.click();
    },
    [model, sounds],
  );

  // a payout (a cash out, or the top rung) sends coins from the plaque to the balance
  const paying =
    phase.name === 'result' &&
    phase.outcome.kind === 'win' &&
    !reducedMotion &&
    lastPlaque.current !== null;
  useEffect(() => {
    const from = lastPlaque.current;
    const balance = hud.current?.querySelector('.plaque.balance');
    if (!paying || !from || !hud.current || !balance) return;
    const flight = { id: performance.now(), from, to: boxIn(hud.current, balance) };
    setFlights((all) => [...all, flight]);
  }, [paying, phase]);
  const landed = useCallback(
    (id: number) => setFlights((all) => all.filter((f) => f.id !== id)),
    [],
  );

  // whether the focused control was reached with Tab, so it keeps its own Space and
  // Enter. Chrome makes even a control focused by a click :focus-visible the moment a
  // key goes down, so the game tracks it itself: Tab sets it, a pointer press clears it
  const tabbed = useRef(false);
  useEffect(() => {
    const onTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') tabbed.current = true;
    };
    const onPointer = () => {
      tabbed.current = false;
    };
    document.addEventListener('keydown', onTab, true);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onTab, true);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, []);

  useEffect(() => {
    // the Space that pressed BET or cashed out must not also click the focused button
    // when it comes up
    let spaceTaken = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (panel || target?.closest('input, textarea, select')) return;
      const state = model.state;
      if (e.key === ' ' || e.key === 'Enter') {
        // a control reached with Tab keeps its own Space and Enter; focus a click or a
        // tap left behind does not
        const control = target?.closest('button, a, [tabindex]');
        if (control && !control.matches('.cashout, .bet-button') && tabbed.current) return;
        // the one button in the middle at the bottom: BET, or the cash out in a run
        const press = canCashOut(state) ? cashOut : canChangeSetup(state) ? placeBet : null;
        if (!press) return;
        e.preventDefault();
        spaceTaken = e.key === ' ';
        setSpaceDown(true);
        setTimeout(() => setSpaceDown(false), KEY_DIP_MS);
        press();
        return;
      }
      const side = e.key === 'ArrowLeft' ? 'outlaw' : e.key === 'ArrowRight' ? 'sheriff' : null;
      if (side) {
        e.preventDefault();
        if (!isIdle(state)) return;
        setPressed(side);
        setTimeout(() => setPressed(null), KEY_DIP_MS);
        onSide(side);
        return;
      }
      const dir = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
      if (dir && canChangeSetup(state)) {
        e.preventDefault();
        const next = nextLevel(state.config.bets, state.bet, dir);
        if (next !== null) {
          model.setBet(next);
          sounds.tick();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== ' ' || !spaceTaken) return;
      spaceTaken = false;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [model, sounds, panel, cashOut, placeBet, onSide]);

  // the bet list closes by itself if a round starts some other way, e.g. a key
  useEffect(() => {
    if (!setupOpen) setPanel((p) => (p === 'bets' ? null : p));
  }, [setupOpen]);

  const outcome = phase.name === 'result' ? phase.outcome.kind : undefined;
  const turbo = s.jurisdiction.turboAllowed;
  const lower = affordableBet(s);

  return (
    <div
      ref={hud}
      class="hud"
      data-phase={phase.name}
      data-run={openRun ? 'live' : undefined}
      data-outcome={outcome === 'lose' ? 'lose' : outcome ? 'win' : undefined}
      data-turbo={turbo ? undefined : 'off'}
    >
      <TitleSign>
        <Ladder ladder={config.ladder} step={step} fmt={fmt} />
      </TitleSign>
      {turbo && (
        <SpeedButton
          speed={speed}
          onChange={(v) => {
            set({ speed: v });
            sounds.click();
          }}
        />
      )}
      <SoundButton
        muted={prefs.muted}
        onToggle={() => {
          set({ muted: !prefs.muted });
          sounds.click();
        }}
      />
      <SettingsButton onOpen={() => open('settings')} />
      <RulesButton onOpen={() => open('rules')} />

      <CoinTap disabled={!idle} onTap={onTurnCoin} />
      <Emblems
        disabled={!idle}
        pressed={pressed}
        chosen={chosen}
        choosing={!openRun}
        nudge={nudge}
        onPick={onSide}
      />
      <SideHint shown={nudge > 0 && chosen === null && setupOpen} />

      <Balance
        balance={s.balance}
        demo={demo}
        reducedMotion={reducedMotion}
        // the count waits for the coins to land
        delay={paying ? PAYOUT_FLIGHT_MS : 0}
        fmt={fmt}
      />
      {openRun ? (
        <CashOut
          prize={openRun.prize}
          multiplier={config.ladder[openRun.step - 1] ?? 1}
          next={nextPrize(config, openRun)}
          chance={config.winChance ?? null}
          disabled={!canCashOut(s)}
          reducedMotion={reducedMotion}
          fmt={fmt}
          plaque={plaque}
          keyDown={spaceDown}
          onCashOut={cashOut}
        />
      ) : (
        <div class="bet-row">
          <Stake
            bets={config.bets}
            bet={s.bet}
            typed={config.customBet != null}
            disabled={!setupOpen}
            fmt={fmt}
            onChange={(bet) => {
              changeBet(bet);
              sounds.tick();
            }}
            onOpen={() => open('bets')}
          />
          <BetButton
            bet={s.bet}
            side={chosen}
            disabled={!setupOpen || panel !== null}
            fmt={fmt}
            keyDown={spaceDown}
            onBet={placeBet}
          />
        </div>
      )}

      {config.customBet && (
        <input
          ref={standIn}
          class="focus-stand-in"
          type="text"
          inputMode="decimal"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {flights.map((f) => (
        <Payout key={f.id} from={f.from} to={f.to} onDone={() => landed(f.id)} />
      ))}

      {phase.name === 'result' && <ResultStamp outcome={phase.outcome} fmt={fmt} />}
      {phase.name === 'error' &&
        (phase.code === 'INSUFFICIENT_FUNDS' ? (
          <FundsNotice
            broke={lower === null}
            canLower={lower !== null && lower < s.bet}
            onLower={async () => {
              // the balance is fetched again first, so the bet goes to what it really covers
              await model.dismissError();
              const bet = affordableBet(model.state);
              if (bet !== null && bet < model.state.bet) model.setBet(bet);
            }}
            onClose={() => void model.dismissError()}
          />
        ) : (
          <ErrorDialog
            code={phase.code}
            fatal={phase.fatal}
            lobbyUrl={lobbyUrl}
            onDismiss={() => void model.dismissError()}
          />
        ))}

      {panel === 'settings' && (
        <SettingsPanel
          sfx={prefs.sfxVolume}
          music={prefs.musicVolume}
          speed={turbo ? speed : null}
          history={s.history}
          onSfx={(v) => set({ sfxVolume: v })}
          onSfxSet={() => sounds.latch()}
          // turning the music up is a clear wish to hear it, so it also unmutes
          onMusic={(v) => set({ musicVolume: v, ...(v > 0 ? { muted: false } : {}) })}
          onSpeed={(v) => {
            set({ speed: v });
            sounds.click();
          }}
          onClose={closePanel}
        />
      )}
      {panel === 'rules' && (
        <Rules
          config={config}
          jurisdiction={s.jurisdiction}
          bet={s.bet}
          demo={demo}
          lang={lang}
          fmt={fmt}
          onClose={closePanel}
        />
      )}
      {panel === 'bets' && (
        <BetPicker
          config={config}
          bet={s.bet}
          balance={s.balance}
          fmt={fmt}
          onChoose={(bet) => {
            changeBet(bet);
            sounds.latch();
            close(true);
          }}
          onClose={closePanel}
        />
      )}
    </div>
  );
}
