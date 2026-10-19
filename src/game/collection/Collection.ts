/**
 * The coin collection while the game runs: the progress, the chosen skin, and
 * the skins just unlocked that the player has not been told of yet.
 *
 * It listens to the round model and counts its results (`unlock.ts`); the
 * scene and the interface read its store. It never touches a round.
 */
import { Store } from '../../shell/store';
import type { RoundState } from '../model/RoundModel';
import { classicOf, skinOf, type CoinManifest, type CoinSkin } from './skins';
import type { CollectionStore } from './store';
import { count, eventsOf, isUnlocked, unlock, type CollectionProgress } from './unlock';

export interface CollectionState {
  progress: CollectionProgress;
  /** Skins unlocked this session that the player has not been told of yet, oldest first. */
  news: string[];
}

export class Collection {
  readonly store: Store<CollectionState>;

  constructor(
    readonly manifest: CoinManifest,
    saved: CollectionProgress,
    private readonly persist: CollectionStore,
    /** The server's ladder length, for rules on the top rung. */
    private readonly ladderLength: number,
  ) {
    // a rule made easier since the last session unlocks quietly; a chosen skin that
    // is gone or locked is the classic one
    let { progress } = unlock(manifest, saved, ladderLength);
    const chosen = chosenSkin(manifest, progress);
    if (chosen !== progress.chosen) progress = { ...progress, chosen };
    this.store = new Store<CollectionState>({ progress, news: [] });
    if (progress !== saved) this.save();
  }

  get state(): CollectionState {
    return this.store.get();
  }

  get chosen(): CoinSkin {
    return skinOf(this.manifest, this.state.progress.chosen) ?? classicOf(this.manifest);
  }

  isUnlocked(id: string): boolean {
    return isUnlocked(this.manifest, this.state.progress, id);
  }

  /** Chooses an unlocked skin; a locked or unknown one is ignored. */
  choose(id: string): void {
    const { progress } = this.state;
    if (id === progress.chosen || !this.isUnlocked(id) || !skinOf(this.manifest, id)) return;
    this.store.set({ ...this.state, progress: { ...progress, chosen: id } });
    this.save();
  }

  /** Counts round results; a skin they unlock joins the news. */
  record(events: ReturnType<typeof eventsOf>): void {
    if (!events.length) return;
    const counted = count(this.state.progress, events);
    const { progress, unlocked } = unlock(this.manifest, counted, this.ladderLength);
    this.store.set({ progress, news: [...this.state.news, ...unlocked] });
    this.save();
  }

  /** The player has been told of `id`. */
  told(id: string): void {
    const { news } = this.state;
    if (news.includes(id)) this.store.set({ ...this.state, news: news.filter((n) => n !== id) });
  }

  /** Counts every result the model shows; returns a function that stops it. */
  watch(rounds: Store<RoundState>): () => void {
    return rounds.subscribe((state, previous) => this.record(eventsOf(state, previous)));
  }

  private save(): void {
    this.persist.save(this.state.progress).catch((err: unknown) => {
      console.warn('The coin collection was not saved', err);
    });
  }
}

/** The skin to show for a saved progress: the chosen one if it exists and is unlocked, else the classic. */
export function chosenSkin(manifest: CoinManifest, progress: CollectionProgress): string {
  const id = progress.chosen;
  return skinOf(manifest, id) && isUnlocked(manifest, progress, id) ? id : manifest.classic;
}
