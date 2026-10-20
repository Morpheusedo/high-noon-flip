/**
 * The HTML interface over the canvas.
 *
 * It reads the round state and the player's settings and calls model methods;
 * it never changes the state itself. Which controls work in which phase comes
 * from the model's questions (`canChangeSetup`, `canCashOut`...), and the CSS
 * hides or dims the rest from the `data-*` attributes on the root.
 *
 * A round starts in two steps: BET sets the bet (`model.arm()`, nothing is sent),
 * then a tap on an emblem (or ← →) places it on that side. A side tapped before
 * BET does nothing but point at BET; BET pressed again, or Escape, lets it go.
 * Whatever is next glows (`guide.ts`), with a pointer and a label for a new
 * player. In a run a tap on a side flips at once, as the run is a string of
 * quick decisions.
 *
 * Keys: Space or Enter BET (cash out in a run), then ← Outlaw, → Sheriff; Escape
 * lets BET go; ↑ ↓ bet. A held key does not repeat: one press is one action, so
 * a key held down can never act as autoplay or run BET into a pick. While the
 * player types a bet in the tab, the keys are theirs and BET waits.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { nextLevel } from '../../server/bets';
import type { Minor, Side } from '../../server/protocol';
import type { Settings } from '../../shell/settings';
import type { Store } from '../../shell/store';
import { useStore } from '../../shell/useStore';
import {
  affordableBet,
  canBet,
  canCashOut,
  canChangeSetup,
  isIdle,
  type RoundModel,
} from '../model/RoundModel';
import { nextPrize } from '../rules';
import type { UiSounds } from '../sound';
import type { Collection } from '../collection/Collection';
import { skinOf } from '../collection/skins';
import type { Tension } from '../tension';
import { BetDial, type DialFeedback } from './BetDial';
import { BetPicker } from './BetPicker';
import { BetTab } from './BetTab';
import { CoinTap, Emblems, SideHint } from './Emblems';
import { formats } from './format';
import { countRound, hintLevel, nextAction } from './guide';
import { CoinNote, CoinsSection, useNextNote, useUnlockNote } from './Coins';
import { useReducedMotion } from './hooks';
import { ErrorDialog, FundsNotice, ResultStamp } from './Notices';
import { PAYOUT_FLIGHT_MS, Payout, type Point } from './Payout';
import { Balance, BetButton, CashOut, Ladder } from './Plaques';
import { Rules, RulesButton } from './Rules';
import { SettingsButton, SettingsPanel, SoundButton } from './Settings';
import { SpeedButton, TitleSign } from './TopBar';
import './app.css';

interface Props {
  model: RoundModel;
  settings: Store<Settings>;
  /** A showdown under way: the controls dim, all but the ladder. */
  tension: Store<Tension>;
  lang: string;
  /** Play money: the balance plaque and the rules say so. */
  demo: boolean;
  /** The operator's lobby, offered when the session cannot go on. */
  lobbyUrl: string | null;
  sounds: UiSounds;
  /** The coin collection: the skins, the chosen one and the ones just unlocked. */
  collection: Collection;
  /** Turns the coin over by hand, for looks. */
  onTurnCoin(): void;
}

/** How long a keycap stays down after its key. */
const KEY_DIP_MS = 110;
/** How long "Press BET first" stays after a side tapped too early, once the hints are quiet. */
const BET_HINT_MS = 3000;

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
  bets: '.dial-tab',
  settings: '.tool.settings',
  rules: '.tool.rules',
};

export function App(props: Props) {
  const { model, settings, tension, lang, demo, lobbyUrl, sounds, collection, onTurnCoin } = props;
  const s = useStore(model.store);
  const coins = useStore(collection.store);
  const prefs = useStore(settings);
  const showdown = useStore(tension);
  const { speed } = prefs;
  const [panel, setPanel] = useState<Panel | null>(null);
  // the settings opened from a new coin's note start at the coins
  const [atCoins, setAtCoins] = useState(false);
  // the bet's tab is a field the player types in: BET and the game's keys wait
  const [typing, setTyping] = useState(false);
  const reducedMotion = useReducedMotion();
  const [pressed, setPressed] = useState<Side | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  // a side tapped before BET: each one pulses BET, and its hint shows for a while
  const [nudge, setNudge] = useState(0);
  const [nudged, setNudged] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);
  const fmt = useMemo(() => formats(s.config.currency, lang), [s.config.currency, lang]);

  const { phase, config, openRun } = s;
  const idle = isIdle(s);
  const setupOpen = canChangeSetup(s);
  const step = openRun?.step ?? 0;
  const hud = useRef<HTMLDivElement>(null);
  const standIn = useRef<HTMLInputElement>(null);
  const open = (p: Panel, coinsFirst = false) => {
    sounds.click();
    setAtCoins(coinsFirst);
    setPanel(p);
  };
  // a new coin is told of between rounds, never over a flip or a panel
  const news = coins.news[0];
  const newCoin =
    news && idle && panel === null ? (skinOf(collection.manifest, news) ?? null) : null;
  const told = useCallback((id: string) => collection.told(id), [collection]);
  // once, as the game loads, how near a returning player is to the next coin; a round
  // that starts drops it, and a game that loads in an open run never shows it
  const [hint, setHint] = useState(() => {
    const next = collection.next;
    return next && next.done > 0 ? next : null;
  });
  useEffect(() => {
    if (hint && (!idle || openRun)) setHint(null);
  }, [hint, idle, openRun]);
  const unlockNote = useUnlockNote();
  const nextNote = useNextNote(config.ladder, fmt);
  const note = newCoin
    ? unlockNote(newCoin)
    : hint && idle && !openRun && panel === null
      ? nextNote(hint)
      : null;
  const noteDone = useCallback(
    (id: string) => (id.startsWith('next:') ? setHint(null) : told(id)),
    [told],
  );
  const onTyping = useCallback(
    (on: boolean) => {
      if (on) {
        sounds.click();
        // iOS raises the keyboard only for a focus inside the tap's own handler, and the
        // bet field mounts after it: a stand-in field takes the focus now, the keyboard
        // comes up, and the real field takes the focus (and the keyboard) over on mount
        standIn.current?.focus({ preventScroll: true });
      }
      setTyping(on);
    },
    [sounds],
  );
  // back to the button that opened it, so a keyboard player keeps their place; once
  // the panel is gone, since the page behind a dialog takes no focus while it is open
  const returnTo = useRef<HTMLElement | null>(null);
  const close = useCallback(
    (quiet = false) => {
      if (!quiet) sounds.click();
      if (panel) returnTo.current = hud.current?.querySelector<HTMLElement>(OPENER[panel]) ?? null;
      setPanel(null);
    },
    [sounds, panel],
  );
  useEffect(() => {
    if (panel !== null || !returnTo.current) return;
    returnTo.current.focus({ preventScroll: true });
    returnTo.current = null;
  }, [panel]);
  const closePanel = useCallback(() => close(), [close]);
  const set = (patch: Partial<typeof prefs>) => settings.set({ ...settings.get(), ...patch });

  const changeBet = (bet: Minor) => model.setBet(bet);
  // the dial ticks per chamber; a flick across two or more ends on the recorded spin
  const dialFeedback: DialFeedback = {
    tick: () => sounds.tick(),
    settle: (coasted) => {
      if (coasted >= 2) return sounds.spin(coasted);
      for (let i = 1; i <= coasted; i++) setTimeout(() => sounds.tick(), i * 42);
      setTimeout(() => sounds.latch(), 60 + coasted * 42);
    },
  };

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

  /** BET: sets the bet and waits for a side; pressed again, lets it go. */
  const onBet = useCallback(() => {
    const state = model.state;
    if (!canBet(state)) return;
    if (state.armed) model.disarm();
    else model.arm();
    sounds.click();
    setNudged(false);
  }, [model, sounds]);
  /** An emblem or an arrow: once BET is pressed it places the bet, in a run it flips. */
  const onSide = useCallback(
    (side: Side) => {
      const state = model.state;
      if (!isIdle(state)) return;
      if (state.openRun) {
        void model.pick(side);
        return;
      }
      if (!state.armed) {
        // too early: nothing happens to the round, BET pulses and says it comes first
        sounds.click();
        setNudge((n) => n + 1);
        setNudged(true);
        return;
      }
      const played = settings.get().roundsPlayed;
      if (hintLevel(played) === 'strong')
        settings.set({ ...settings.get(), roundsPlayed: countRound(played) });
      void model.pick(side);
    },
    [model, sounds, settings],
  );
  // once the hints are quiet, the note after a side tapped too early fades by itself
  useEffect(() => {
    if (!nudged) return;
    const timer = setTimeout(() => setNudged(false), BET_HINT_MS);
    return () => clearTimeout(timer);
  }, [nudged, nudge]);

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
      if (panel || typing || target?.closest('input, textarea, select, form')) return;
      const state = model.state;
      if (e.key === 'Escape') {
        if (state.armed && isIdle(state)) {
          e.preventDefault();
          onBet();
        }
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        // a control reached with Tab keeps its own Space and Enter; focus a click or a
        // tap left behind does not
        const control = target?.closest('button, a, [tabindex]');
        if (control && !control.matches('.cashout, .bet-button') && tabbed.current) return;
        // the one button in the middle at the bottom: BET, or the cash out in a run
        const press = canCashOut(state) ? cashOut : canBet(state) ? onBet : null;
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
  }, [model, sounds, panel, typing, cashOut, onBet, onSide]);

  // the bet list closes by itself if a round starts some other way, e.g. a key
  useEffect(() => {
    if (setupOpen) return;
    setPanel((p) => (p === 'bets' ? null : p));
    setTyping(false);
  }, [setupOpen]);

  const outcome = phase.name === 'result' ? phase.outcome.kind : undefined;
  const turbo = s.jurisdiction.turboAllowed;
  const lower = affordableBet(s);
  // what to press next, and whether a new player still gets the pointer and the label
  const next = panel === null && !typing ? nextAction(s) : null;
  const strong = hintLevel(prefs.roundsPlayed) === 'strong';

  return (
    <div
      ref={hud}
      class="hud"
      data-phase={phase.name}
      data-run={openRun ? 'live' : undefined}
      data-outcome={outcome === 'lose' ? 'lose' : outcome ? 'win' : undefined}
      data-turbo={turbo ? undefined : 'off'}
      data-tension={showdown.dimHud ? showdown.level : undefined}
      data-next={next ?? undefined}
      style={{
        '--tension-ms': `${showdown.level ? showdown.inMs : showdown.outMs}ms`,
        '--tension-light': showdown.light,
      }}
    >
      <TitleSign>
        <Ladder ladder={config.ladder} step={step} fmt={fmt} />
      </TitleSign>
      {/* everything the player presses, so a showdown can dim it as one, all but the
          ladder; each control keeps its own opacity for its own states */}
      <div class="controls">
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
          waiting={!openRun && !s.armed}
          onPick={onSide}
        />
        <SideHint shown={next === 'side' && strong} />

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
          <>
            <BetDial
              bets={config.bets}
              bet={s.bet}
              disabled={!setupOpen}
              fmt={fmt}
              onChange={changeBet}
              feedback={dialFeedback}
            >
              <BetTab
                config={config}
                bet={s.bet}
                balance={s.balance}
                disabled={!setupOpen}
                fmt={fmt}
                onOpen={() => open('bets')}
                onTyping={onTyping}
                onChoose={(bet) => {
                  changeBet(bet);
                  sounds.latch();
                }}
              />
            </BetDial>
            <BetButton
              bet={s.bet}
              armed={s.armed}
              next={next === 'bet'}
              hint={next === 'bet' && (strong || nudged)}
              nudge={nudge}
              disabled={!canBet(s) || panel !== null || typing}
              fmt={fmt}
              keyDown={spaceDown}
              onBet={onBet}
            />
          </>
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
      </div>

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

      <CoinNote
        manifest={collection.manifest}
        note={note}
        reducedMotion={reducedMotion}
        onOpen={() => {
          if (newCoin) collection.told(newCoin.id);
          setHint(null);
          open('settings', true);
        }}
        onDone={noteDone}
      />

      {panel === 'settings' && (
        <SettingsPanel
          sfx={prefs.sfxVolume}
          music={prefs.musicVolume}
          speed={turbo ? speed : null}
          history={s.history}
          onSfx={(v) => set({ sfxVolume: v })}
          onSfxSet={() => sounds.latch()}
          // turning the music up is a clear wish to hear it, so it also unmutes; turning it down is not
          onMusic={(v) =>
            set({ musicVolume: v, ...(v > prefs.musicVolume ? { muted: false } : {}) })
          }
          onSpeed={(v) => {
            set({ speed: v });
            sounds.click();
          }}
          coins={
            <CoinsSection
              manifest={collection.manifest}
              state={coins}
              ladder={config.ladder}
              fmt={fmt}
              autofocus={atCoins}
              onChoose={(id) => {
                collection.choose(id);
                sounds.click();
              }}
            />
          }
          atCoins={atCoins}
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
          bets={config.bets}
          bet={s.bet}
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
