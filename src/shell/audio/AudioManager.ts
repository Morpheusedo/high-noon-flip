/**
 * The one place a game makes sound. Shared by every game.
 *
 *   effects ──▶ sfx bus ──┐
 *   synth   ──▶ sfx bus ──┼──▶ master ──▶ speakers
 *   music layers ─▶ filter ─▶ duck ─▶ music bus ──┘
 *
 * - One AudioContext. Browsers keep it silent until the player touches the
 *   page, so it is unlocked on the first tap or key, and music starts then.
 * - It goes quiet while the tab is hidden: a game in a background tab of the
 *   casino must not keep playing.
 * - Sound effects come from one sprite; music is a set of looping layers the
 *   game blends (see `setMusicLayers`).
 * - Loading never blocks the game: until the files arrive, `play` returns
 *   false and the game may fall back to a synthesized sound or stay silent.
 */
import { browserCanPlay, pickFile, type AudioManifest } from './manifest';

export interface Volumes {
  muted: boolean;
  /** Sound effects, 0 to 100. */
  sfx: number;
  /** Music, 0 to 100. */
  music: number;
}

export interface PlayOptions {
  /** 0 to 1, on top of the effects volume. */
  gain?: number;
  /** Playback speed; also shifts the pitch. */
  rate?: number;
  /** Start this many seconds into the clip. */
  offset?: number;
  /** Fade in over this many seconds. */
  fadeIn?: number;
  /** Seconds from now. */
  when?: number;
}

/** Effects follow the slider in a straight line; music rises slower, as ears expect. */
export function sfxGain(v: Volumes): number {
  return v.muted ? 0 : clamp01(v.sfx / 100);
}

export function musicGain(v: Volumes): number {
  return v.muted ? 0 : Math.pow(clamp01(v.music / 100), 1.6) * 0.9;
}

const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;

interface Layer {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class AudioManager {
  readonly ctx: AudioContext | null;
  /** Synthesized sounds connect here, so they follow the effects volume. */
  readonly sfx: GainNode | null;
  private readonly music: GainNode | null;
  private readonly musicFilter: BiquadFilterNode | null;
  /** Lowers the music for a moment of suspense, apart from the player's volume. */
  private readonly musicDuck: GainNode | null;
  private sprite: { buffer: AudioBuffer; clips: AudioManifest['sprite']['clips'] } | null = null;
  private loops: Record<string, { buffer: AudioBuffer; loopStart: number; loopEnd: number }> = {};
  private layers: Record<string, Layer> = {};
  private layerGains: Record<string, number> = {};
  private musicCutoff = 18000;
  private unlocked = false;
  private volumes: Volumes = { muted: false, sfx: 100, music: 100 };

  constructor() {
    const Ctx = typeof window === 'undefined' ? undefined : window.AudioContext;
    // no Web Audio (an old webview): the game runs silent rather than not at all
    this.ctx = Ctx ? new Ctx() : null;
    if (!this.ctx) {
      this.sfx = this.music = this.musicFilter = this.musicDuck = null;
      return;
    }
    const master = this.ctx.createGain();
    master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.connect(master);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0;
    this.music.connect(master);
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicDuck = this.ctx.createGain();
    this.musicFilter.connect(this.musicDuck).connect(this.music);
  }

  /** Fetches and decodes the sprite and the music. Failures leave the game silent, not broken. */
  async load(url: (file: string) => string, manifestFile = 'audio.json'): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const manifest = (await (await fetch(url(manifestFile))).json()) as AudioManifest;
    const decode = async (file: string | null) => {
      if (!file) throw new Error('No audio format this browser can play');
      const response = await fetch(url(file));
      if (!response.ok) throw new Error(`${file}: ${response.status}`);
      return ctx.decodeAudioData(await response.arrayBuffer());
    };
    const effects = decode(pickFile(manifest.sprite.files, browserCanPlay)).then((buffer) => {
      this.sprite = { buffer, clips: manifest.sprite.clips };
    });
    const music = Object.entries(manifest.music).map(async ([name, m]) => {
      const buffer = await decode(pickFile(m.files, browserCanPlay));
      this.loops[name] = { buffer, loopStart: m.loopStart, loopEnd: m.loopEnd };
    });
    const results = await Promise.allSettled([effects, ...music]);
    for (const r of results)
      if (r.status === 'rejected') console.warn('Audio not loaded:', r.reason);
    this.startMusic();
  }

  /** Starts sound on the first touch or key anywhere in `doc`, and pauses it while the tab is hidden. */
  listen(doc: Document = document): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const unlock = () => {
      void ctx.resume().then(() => {
        if (ctx.state !== 'running') return;
        this.unlocked = true;
        this.startMusic();
        for (const ev of UNLOCK_EVENTS) doc.removeEventListener(ev, unlock, true);
      });
    };
    for (const ev of UNLOCK_EVENTS) doc.addEventListener(ev, unlock, true);
    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) void ctx.suspend();
      else if (this.unlocked) void ctx.resume();
    });
  }

  setVolumes(volumes: Volumes): void {
    this.volumes = volumes;
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.music) return;
    this.sfx.gain.setTargetAtTime(sfxGain(volumes), ctx.currentTime, 0.02);
    this.music.gain.setTargetAtTime(musicGain(volumes), ctx.currentTime, 0.08);
  }

  /** Whether effects can be heard right now; a caller may skip work for silent sounds. */
  get audible(): boolean {
    return !!this.ctx && sfxGain(this.volumes) > 0;
  }

  /** Length of a clip in the sprite, or 0 before it has loaded. */
  clipLength(name: string): number {
    return this.sprite?.clips[name]?.[1] ?? 0;
  }

  /** Plays a clip from the sprite; false if it has not loaded, so the caller can fall back. */
  play(name: string, o: PlayOptions = {}): boolean {
    const ctx = this.ctx;
    const clip = this.sprite?.clips[name];
    if (!ctx || !this.sfx || !this.sprite || !clip) return false;
    if (!this.audible) return true;
    const [start, length] = clip;
    const offset = Math.min(length, Math.max(0, o.offset ?? 0));
    const at = ctx.currentTime + (o.when ?? 0);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const level = o.gain ?? 1;
    src.buffer = this.sprite.buffer;
    src.playbackRate.value = o.rate ?? 1;
    gain.gain.setValueAtTime(o.fadeIn ? 0.0001 : level, at);
    if (o.fadeIn) gain.gain.linearRampToValueAtTime(level, at + o.fadeIn);
    src.connect(gain).connect(this.sfx);
    // play only this clip's stretch of the sprite
    src.start(at, start + offset, length - offset);
    return true;
  }

  /**
   * Sets how loud each music layer is (0 to 1) and how bright the mix is
   * (low-pass cutoff in Hz). Changes glide over about `glide` seconds.
   */
  setMusicLayers(gains: Record<string, number>, cutoffHz: number, glide = 0.9): void {
    this.layerGains = gains;
    this.musicCutoff = cutoffHz;
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter) return;
    for (const [name, layer] of Object.entries(this.layers))
      layer.gain.gain.setTargetAtTime(gains[name] ?? 0, ctx.currentTime, glide);
    this.musicFilter.frequency.setTargetAtTime(cutoffHz, ctx.currentTime, glide);
  }

  /**
   * Lowers the music by `db` (negative), or brings it back with 0, over about
   * `seconds`. Apart from the player's music volume, which it never changes.
   */
  duckMusic(db: number, seconds = 0.3): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicDuck) return;
    const gain = Math.pow(10, Math.min(0, db) / 20);
    this.musicDuck.gain.setTargetAtTime(gain, ctx.currentTime, Math.max(0.01, seconds / 3));
  }

  /** Whether sound is playing at all: unlocked by the player and the tab in view. */
  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** All layers start together once the player has unlocked sound and the music has loaded. */
  private startMusic(): void {
    const ctx = this.ctx;
    const filter = this.musicFilter;
    if (!ctx || !filter || !this.unlocked || Object.keys(this.layers).length > 0) return;
    const names = Object.keys(this.loops);
    if (names.length === 0) return;
    const at = ctx.currentTime + 0.05;
    for (const name of names) {
      const loop = this.loops[name];
      if (!loop) continue;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = loop.buffer;
      source.loop = true;
      source.loopStart = loop.loopStart;
      source.loopEnd = loop.loopEnd;
      gain.gain.value = 0;
      source.connect(gain).connect(filter);
      source.start(at, loop.loopStart);
      this.layers[name] = { source, gain };
    }
    this.setMusicLayers(this.layerGains, this.musicCutoff, 0.25);
    this.setVolumes(this.volumes);
  }
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
