#!/usr/bin/env node
/**
 * Builds the game's audio from assets-src/audio into public/assets/audio:
 *
 * - every file in sfx/ goes into one sprite, sfx.m4a (AAC), with a quarter
 *   second of silence around each clip;
 * - each music loop is copied as .m4a;
 * - audio.json says where each clip starts and how long it is, and where each
 *   loop starts and ends.
 *
 * Then it decodes the sprite again and checks that every clip still starts
 * where audio.json says: encoders add a little delay at the start of a file,
 * and a clip that started late would lose the attack of its sound.
 *
 * Uses afconvert, which comes with macOS. It cannot write Ogg or WebM Opus, so
 * the build is AAC only; audio.json lists the files per format, so an Opus
 * build can be added next to it without changing the game. Run: npm run audio
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';

const SRC = 'assets-src/audio';
const OUT = 'public/assets/audio';
const RATE = 44100;
const GAP_S = 0.25;
/** Loudness above which a sample counts as sound, for finding where a clip starts. */
const ONSET = 0.02 * 32767;
/** How far a clip may start from where audio.json says before the build fails. */
const TOLERANCE_MS = 6;

const tmp = mkdtempSync(join(tmpdir(), 'hnf-audio-'));
const afconvert = (...args) => execFileSync('afconvert', args, { stdio: 'pipe' });

function decode(file) {
  const wav = join(tmp, `${basename(file)}.wav`);
  afconvert('-f', 'WAVE', '-d', `LEI16@${RATE}`, '-c', '1', file, wav);
  return readPcm(wav);
}

/** The 16-bit samples of a mono WAV file. */
function readPcm(file) {
  const buf = readFileSync(file);
  let at = 12;
  while (at < buf.length) {
    const id = buf.toString('ascii', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === 'data')
      return new Int16Array(
        buf.buffer.slice(buf.byteOffset + at + 8, buf.byteOffset + at + 8 + size),
      );
    at += 8 + size + (size % 2);
  }
  throw new Error(`${file}: no audio data`);
}

function writeWav(file, pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.byteLength, 40);
  writeFileSync(file, Buffer.concat([header, Buffer.from(pcm.buffer)]));
}

function onset(pcm, from) {
  for (let i = Math.max(0, from); i < pcm.length; i++) if (Math.abs(pcm[i]) > ONSET) return i;
  return -1;
}

/* ---------- the sprite ---------- */

const gap = Math.round(GAP_S * RATE);
const names = readdirSync(join(SRC, 'sfx'))
  .filter((f) => !f.startsWith('.'))
  .sort();
const clips = names.map((file) => ({
  // snd-tick.mp4 → tick, rico-01.mp4 → rico-01
  name: basename(file, extname(file)).replace(/^snd-/, ''),
  pcm: decode(join(SRC, 'sfx', file)),
}));

const total = gap + clips.reduce((n, c) => n + c.pcm.length + gap, 0);
const sprite = new Int16Array(total);
let at = gap;
const layout = {};
for (const clip of clips) {
  sprite.set(clip.pcm, at);
  clip.start = at;
  layout[clip.name] = [round(at / RATE), round(clip.pcm.length / RATE)];
  at += clip.pcm.length + gap;
}

mkdirSync(OUT, { recursive: true });
const spriteWav = join(tmp, 'sfx.wav');
writeWav(spriteWav, sprite);
afconvert('-f', 'm4af', '-d', 'aac', '-b', '80000', spriteWav, join(OUT, 'sfx.m4a'));

/* ---------- music ---------- */

const music = {};
const loops = JSON.parse(readFileSync(join(SRC, 'music', 'music.json'), 'utf8'));
for (const [name, loop] of Object.entries(loops)) {
  const source = join(SRC, 'music', loop.file);
  const stem = basename(loop.file, extname(loop.file));
  // the source is already AAC: copied as it is, not encoded a second time
  copyFileSync(source, join(OUT, `${stem}.m4a`));
  music[name] = {
    files: { m4a: `${stem}.m4a` },
    loopStart: loop.loopStart,
    loopEnd: round(loop.loopStart + loop.loopLength),
  };
}

writeFileSync(
  join(OUT, 'audio.json'),
  `${JSON.stringify({ sprite: { files: { m4a: 'sfx.m4a' }, clips: layout }, music }, null, 2)}\n`,
);

/* ---------- check ---------- */

let worst = 0;
for (const format of ['m4a']) {
  const decoded = decode(join(OUT, `sfx.${format}`));
  for (const clip of clips) {
    const expected = onset(sprite, clip.start);
    const found = onset(decoded, clip.start - Math.floor(gap / 2));
    const ms = ((found - expected) / RATE) * 1000;
    worst = Math.max(worst, Math.abs(ms));
    if (Math.abs(ms) > TOLERANCE_MS)
      console.error(`sfx.${format} ${clip.name}: starts ${ms.toFixed(1)} ms off`);
  }
}
rmSync(tmp, { recursive: true });
if (worst > TOLERANCE_MS) process.exit(1);
console.log(
  `${clips.length} clips, ${round(total / RATE)} s; every clip within ${worst.toFixed(1)} ms of audio.json`,
);

function round(s) {
  return Math.round(s * 10000) / 10000;
}
