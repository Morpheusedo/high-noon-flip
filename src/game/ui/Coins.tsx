/**
 * The coin collection: the "Coins" section of the settings, and the notes over
 * the game, that a coin was unlocked or how near the next one is.
 *
 * The coins are a path, from the rusty one a new player wears to gold, shown in
 * the manifest's order. Unlocked coins can be chosen and the scene swaps the coin
 * at once; a locked one is a silhouette with the play that unlocks it. Under them
 * stands the next coin and how far the player is. The icons are fetched when the
 * settings open, not with the game.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CollectionState } from '../collection/Collection';
import { coinUrl, type CoinManifest, type CoinSkin } from '../collection/skins';
import { isUnlocked, nextCoin, progressOf, type NextCoin } from '../collection/unlock';
import type { Text } from '../../locales';
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
  const text = useText();
  const { t } = text;
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (autofocus) section.current?.scrollIntoView({ block: 'nearest' });
  }, [autofocus]);
  const { progress } = state;
  const owned = manifest.skins.filter((s) => isUnlocked(manifest, progress, s.id)).length;
  const rule = useRule(ladder, fmt);
  const next = nextCoin(manifest, progress, ladder.length);
  return (
    <section ref={section} class="coins" aria-labelledby="coins-title">
      <h3 id="coins-title">
        {t('coins.title')}
        <small>{t('coins.count', { owned, total: manifest.skins.length })}</small>
      </h3>
      <ul class="coin-grid">
        {manifest.skins.map((skin) => {
          const name = skinName(text, skin);
          const rank = rankOf(text, skin);
          const unlocked = isUnlocked(manifest, progress, skin.id);
          const chosen = skin.id === progress.chosen;
          const caption = unlocked || !skin.unlock ? name : rule(skin, state);
          const label = rank ? t('coins.named', { name, rank }) : name;
          return (
            <li key={skin.id}>
              <button
                class={`coin-skin${unlocked ? '' : ' locked'}`}
                aria-pressed={unlocked ? chosen : undefined}
                aria-disabled={unlocked ? undefined : 'true'}
                aria-label={unlocked ? label : t('coins.locked', { name: label, rule: caption })}
                data-autofocus={autofocus && chosen ? true : undefined}
                onClick={() => unlocked && onChoose(skin.id)}
              >
                <CoinIcon manifest={manifest} skin={skin} />
                <span class="coin-caption" aria-hidden="true">
                  {caption}
                </span>
                {rank && (
                  <span class="coin-rank" aria-hidden="true">
                    {rank}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <NextLine next={next} ladder={ladder} fmt={fmt} />
      <p class="dialog-note">{t('coins.note')}</p>
    </section>
  );
}

/** "Next: Silver, rung 3 in 2 of 3 runs" with a bar, or "Collection complete". */
function NextLine({
  next,
  ladder,
  fmt,
}: {
  next: NextCoin | null;
  ladder: number[];
  fmt: Formats;
}) {
  const { t } = useText();
  const text = useNextText(ladder, fmt);
  if (!next) return <p class="coin-next complete">{t('coins.complete')}</p>;
  return (
    <div class="coin-next">
      <p>{text(next)}</p>
      <span class="coin-bar" aria-hidden="true">
        <span style={{ width: `${(100 * next.done) / next.goal}%` }} />
      </span>
    </div>
  );
}

function skinName({ t }: Text, skin: CoinSkin): string {
  return t(`coins.skin.${skin.id}` as 'coins.skin.classic');
}

/** The title a coin stands for ("Old hand"); none for the coin a player starts with. */
function rankOf({ t }: Text, skin: CoinSkin): string | null {
  return skin.unlock ? t(`coins.rank.${skin.id}` as 'coins.rank.classic') : null;
}

/** "Next: Silver, rung 3 in 2 of 3 runs": the next coin and how far the player is. */
export function nextText(
  text: Text,
  ladder: number[],
  fmt: Formats,
  { skin, rule, done, goal }: NextCoin,
): string {
  const { t } = text;
  const times = (rung: number) => fmt.multiplier(ladder[rung - 1] ?? 0);
  let how: string;
  if ('flips' in rule) how = t('coins.next.flips', { done, count: goal });
  else if ('cashout' in rule)
    how = done
      ? t('coins.next.cashoutBest', { multiplier: times(goal), best: times(done) })
      : t('coins.next.cashout', { multiplier: times(goal) });
  else if (rule.runs !== undefined)
    how = t('coins.next.runs', {
      rung: rule.rung === 'top' ? ladder.length : rule.rung,
      done,
      count: goal,
    });
  else
    how = done
      ? t('coins.next.rungBest', { rung: goal, best: done })
      : t('coins.next.rung', { rung: goal });
  return t('coins.next', { name: skinName(text, skin), how });
}

function useNextText(ladder: number[], fmt: Formats): (next: NextCoin) => string {
  const text = useText();
  return (next) => nextText(text, ladder, fmt, next);
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
    // a count of flips or runs; a rung or a cash out reads better in the line under the grid
    const counted = 'flips' in rule || ('runs' in rule && rule.runs !== undefined);
    const { done, goal } = progressOf(rule, state.progress, top);
    return counted && goal > 1 && done > 0
      ? t('coins.rule.progress', { rule: text, done, goal })
      : text;
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

/** A note over the game: a coin just unlocked, or how near a returning player is to the next one. */
export interface CoinNoteContent {
  /** Which note this is; the time it has left is kept per id while a round hides it. */
  id: string;
  skin: CoinSkin;
  /** What it says: "New coin: Silver — Old hand". */
  text: string;
  /** What a screen reader hears on the button: the text and that a tap shows the coins. */
  label: string;
  /** How long it stays, in milliseconds of being shown. */
  ms: number;
  /** The coin is still to be won: its icon is a silhouette, as in the grid. */
  locked?: boolean;
}

interface NoteProps {
  manifest: CoinManifest;
  /** The note to show, or null when there is none to show now. */
  note: CoinNoteContent | null;
  reducedMotion: boolean;
  onOpen(): void;
  /** The note has been shown long enough. */
  onDone(id: string): void;
}

/** How long "New coin: Silver" stays. */
export const UNLOCK_NOTE_MS = 4500;
/** How long the next coin's progress stays after the game loads: a reminder, not a banner. */
export const NEXT_NOTE_MS = 3500;

/**
 * A note with a coin's icon under the ladder, clear of BET and the cash out. A
 * tap opens the coins in the settings. It is gone while a round plays and comes
 * back after it for the rest of its time, so it never stands over a flip. The
 * region stays mounted so a screen reader announces it.
 */
export function CoinNote({ manifest, note, reducedMotion, onOpen, onDone }: NoteProps) {
  const left = useRef<{ id: string; ms: number } | null>(null);
  useEffect(() => {
    if (!note) return;
    if (left.current?.id !== note.id) left.current = { id: note.id, ms: note.ms };
    const shown = left.current;
    const since = performance.now();
    const timer = setTimeout(() => onDone(note.id), shown.ms);
    return () => {
      clearTimeout(timer);
      shown.ms = Math.max(0, shown.ms - (performance.now() - since));
    };
  }, [note?.id, note?.ms, onDone]);
  return (
    <div class="unlock-toast-region" role="status">
      {note && (
        <button
          key={note.id}
          class={`unlock-toast${reducedMotion ? ' still' : ''}${note.locked ? ' locked' : ''}`}
          aria-label={note.label}
          onClick={onOpen}
        >
          <CoinIcon manifest={manifest} skin={note.skin} />
          <span>{note.text}</span>
        </button>
      )}
    </div>
  );
}

/** "New coin: Silver — Old hand", for a skin just unlocked. */
export function useUnlockNote(): (skin: CoinSkin) => CoinNoteContent {
  const text = useText();
  const { t } = text;
  return (skin) => {
    const rank = rankOf(text, skin);
    const name = skinName(text, skin);
    const named = rank ? t('coins.named', { name, rank }) : name;
    return {
      id: skin.id,
      skin,
      text: t('coins.new', { name: named }),
      label: t('coins.newOpen', { name: named }),
      ms: UNLOCK_NOTE_MS,
    };
  };
}

/** "Next: Silver, rung 3 in 2 of 3 runs", for a returning player. */
export function useNextNote(ladder: number[], fmt: Formats): (next: NextCoin) => CoinNoteContent {
  const { t } = useText();
  const nextText = useNextText(ladder, fmt);
  return (next) => {
    const text = nextText(next);
    return {
      id: `next:${next.skin.id}`,
      skin: next.skin,
      text,
      label: t('coins.nextOpen', { text }),
      ms: NEXT_NOTE_MS,
      locked: true,
    };
  };
}
