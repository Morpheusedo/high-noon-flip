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
import type { UiSounds } from '../sound';
import { BetPicker } from './BetPicker';
import { CoinTap, Emblems } from './Emblems';
import { formats } from './format';
import { useReducedMotion } from './hooks';
import { ErrorDialog, FundsNotice, ResultStamp } from './Notices';
import { Balance, CashOut, Ladder, Stake } from './Plaques';
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

/** How long a keycap stays down after its arrow key. */
const KEY_DIP_MS = 110;

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
  const fmt = useMemo(() => formats(s.config.currency, lang), [s.config.currency, lang]);

  const { phase, config, openRun } = s;
  const idle = isIdle(s);
  const setupOpen = canChangeSetup(s);
  const step = openRun?.step ?? 0;
  const hud = useRef<HTMLDivElement>(null);
  const open = (p: Panel) => {
    sounds.click();
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (panel || target?.closest('input, textarea, select')) return;
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
        const next = nextLevel(state.config.bets, state.bet, dir);
        if (next !== null) {
          model.setBet(next);
          sounds.tick();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [model, sounds, panel]);

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
      <TitleSign history={s.history} />
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
      <Emblems disabled={!idle} pressed={pressed} onPick={(side) => void model.pick(side)} />

      <Balance balance={s.balance} demo={demo} reducedMotion={reducedMotion} fmt={fmt} />
      <Ladder ladder={config.ladder} step={step} fmt={fmt} />
      {openRun ? (
        <CashOut
          prize={openRun.prize}
          disabled={!canCashOut(s)}
          fmt={fmt}
          onCashOut={() => void model.cashOut()}
        />
      ) : (
        <Stake
          bets={config.bets}
          bet={s.bet}
          disabled={!setupOpen}
          fmt={fmt}
          onChange={(bet) => {
            changeBet(bet);
            sounds.tick();
          }}
          onOpen={() => open('bets')}
        />
      )}

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
