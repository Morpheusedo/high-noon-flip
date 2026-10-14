/**
 * Sounds made in code: short tones and noise bursts. A game uses them as
 * placeholders until its sound designer delivers recordings; a recording added
 * to the sprite under the same name replaces the placeholder.
 */

export interface Tone {
  freq: number;
  /** Seconds. */
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Seconds from now. */
  when?: number;
  /** Glide to this frequency over the tone. */
  slideTo?: number;
}

export function tone(ctx: BaseAudioContext, out: AudioNode, t: Tone): void {
  const at = ctx.currentTime + (t.when ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = t.type ?? 'sine';
  osc.frequency.setValueAtTime(t.freq, at);
  if (t.slideTo) osc.frequency.exponentialRampToValueAtTime(t.slideTo, at + t.dur);
  gain.gain.setValueAtTime(t.gain ?? 0.2, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + t.dur);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + t.dur + 0.02);
}

export interface Noise {
  dur: number;
  gain: number;
  when?: number;
  /** Low-pass cutoff in Hz. */
  cutoff?: number;
}

/** A burst of noise that dies away: shots, clicks, scrapes. */
export function noise(ctx: BaseAudioContext, out: AudioNode, n: Noise): void {
  const length = Math.max(1, Math.floor(ctx.sampleRate * n.dur));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++)
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = 'lowpass';
  filter.frequency.value = n.cutoff ?? 1800;
  gain.gain.value = n.gain;
  src.buffer = buffer;
  src.connect(filter).connect(gain).connect(out);
  src.start(ctx.currentTime + (n.when ?? 0));
}
