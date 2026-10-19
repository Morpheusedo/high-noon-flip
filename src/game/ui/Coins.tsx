/**
 * The coin collection: the "Coins" section of the settings, and the note that
 * a coin was unlocked.
 *
 * Unlocked coins can be chosen and the scene swaps the coin at once; a locked one
 * is a silhouette with the play that unlocks it. The icons are fetched when the
 * settings open, not with the game.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CollectionState } from '../collection/Collection';
import { coinUrl, type CoinManifest, type CoinSkin } from '../collection/skins';
import { isUnlocked, progressOf } from '../collection/unlock';
import type { Formats } from './format';
import { useText } from './text';
import './Coins.css';

interface CoinsProps {
  manifest: CoinManifest;
  state: CollectionState;
  /** The server's ladder, for the rules that name a rung's multiplier. */
  ladder: number[];
  fmt: Formats;
  /** The chosen coin takes the focus when the panel opens, and is scrolled into view. */
  autofocus: boolean;
  onChoose(id: string): void;
}

/** The skins in a grid: a name under each one the player has, the rule under each one they do not. */
export function CoinsSection({ manifest, state, ladder, fmt, autofocus, onChoose }: CoinsProps) {
  const { t } = useText();
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (autofocus) section.current?.scrollIntoView({ block: 'nearest' });
  }, [autofocus]);
  const { progress } = state;
  const owned = manifest.skins.filter((s) => isUnlocked(manifest, progress, s.id)).length;
  const rule = useRule(ladder, fmt);
  return (
    <section ref={section} class="coins" aria-labelledby="coins-title">
      <h3 id="coins-title">
        {t('coins.title')}
        <small>{t('coins.count', { owned, total: manifest.skins.length })}</small>
      </h3>
      <ul class="coin-grid">
        {manifest.skins.map((skin) => {
          const name = t(`coins.skin.${skin.id}` as 'coins.skin.classic');
          const unlocked = isUnlocked(manifest, progress, skin.id);
          const chosen = skin.id === progress.chosen;
          const caption = unlocked || !skin.unlock ? name : rule(skin, state);
          return (
            <li key={skin.id}>
              <button
                class={`coin-skin${unlocked ? '' : ' locked'}`}
                aria-pressed={unlocked ? chosen : undefined}
                aria-disabled={unlocked ? undefined : 'true'}
                aria-label={unlocked ? name : t('coins.locked', { name, rule: caption })}
                data-autofocus={autofocus && chosen ? true : undefined}
                onClick={() => unlocked && onChoose(skin.id)}
              >
                <CoinIcon manifest={manifest} skin={skin} />
                <span class="coin-caption" aria-hidden="true">
                  {caption}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p class="dialog-note">{t('coins.note')}</p>
    </section>
  );
}

/** "Reach rung 5", "Make 50 flips (12/50)": what unlocks `skin`, and how far the player is. */
function useRule(ladder: number[], fmt: Formats) {
  const { t } = useText();
  return (skin: CoinSkin, state: CollectionState): string => {
    const rule = skin.unlock;
    if (!rule) return '';
    const top = ladder.length;
    const rungOf = (r: number | 'top') => (r === 'top' ? top : r);
    let text: string;
    if ('flips' in rule) text = t('coins.rule.flips', { count: rule.flips });
    else if ('cashout' in rule)
      text = t('coins.rule.cashout', {
        multiplier: fmt.multiplier(ladder[rungOf(rule.cashout) - 1] ?? 0),
      });
    else if (rule.runs && rule.runs > 1)
      text = t('coins.rule.runs', { rung: rungOf(rule.rung), count: rule.runs });
    else if (rungOf(rule.rung) === top) text = t('coins.rule.top');
    else text = t('coins.rule.rung', { rung: rungOf(rule.rung) });
    const { done, goal } = progressOf(rule, state.progress, top);
    return goal > 1 && done > 0 ? t('coins.rule.progress', { rule: text, done, goal }) : text;
  };
}

/** A skin's icon; the classic one, with a console warning, when its art is missing. */
function CoinIcon({ manifest, skin }: { manifest: CoinManifest; skin: CoinSkin }) {
  const classic = manifest.skins.find((s) => s.id === manifest.classic);
  const [file, setFile] = useState(skin.icon);
  return (
    <img
      class="coin-icon"
      src={coinUrl(file)}
      alt=""
      draggable={false}
      onError={() => {
        if (!classic || file === classic.icon) return;
        console.warn(`Coin "${skin.id}": icon is missing, showing the classic one`);
        setFile(classic.icon);
      }}
    />
  );
}

interface ToastProps {
  manifest: CoinManifest;
  /** The coin to announce, or null when there is none to show now. */
  skin: CoinSkin | null;
  reducedMotion: boolean;
  /** How long the note stays, in milliseconds of being shown. */
  ms?: number;
  onOpen(): void;
  /** The note has been shown long enough. */
  onDone(id: string): void;
}

const TOAST_MS = 4500;

/**
 * "New coin: Silver" with its icon, after a result. A tap opens the coins in the
 * settings. It is gone while a round plays and comes back after it for the rest of
 * its time, so it never stands over a flip. The region stays mounted so a screen
 * reader announces it.
 */
export function UnlockToast({
  manifest,
  skin,
  reducedMotion,
  ms = TOAST_MS,
  onOpen,
  onDone,
}: ToastProps) {
  const { t } = useText();
  const left = useRef<{ id: string; ms: number } | null>(null);
  useEffect(() => {
    if (!skin) return;
    if (left.current?.id !== skin.id) left.current = { id: skin.id, ms };
    const shown = left.current;
    const since = performance.now();
    const timer = setTimeout(() => onDone(skin.id), shown.ms);
    return () => {
      clearTimeout(timer);
      shown.ms = Math.max(0, shown.ms - (performance.now() - since));
    };
  }, [skin, ms, onDone]);
  const name = skin ? t(`coins.skin.${skin.id}` as 'coins.skin.classic') : '';
  return (
    <div class="unlock-toast-region" role="status">
      {skin && (
        <button
          key={skin.id}
          class={`unlock-toast${reducedMotion ? ' still' : ''}`}
          aria-label={t('coins.newOpen', { name })}
          onClick={onOpen}
        >
          <CoinIcon manifest={manifest} skin={skin} />
          <span>{t('coins.new', { name })}</span>
        </button>
      )}
    </div>
  );
}
