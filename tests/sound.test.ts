import { describe, expect, it } from 'vitest';
import { RoundModel } from '../src/game/model/RoundModel';
import { GameSounds, musicIntensity, musicMix } from '../src/game/sound';
import { musicGain, sfxGain, type AudioManager } from '../src/shell/audio/AudioManager';
import { pickFile } from '../src/shell/audio/manifest';
import { MockServer } from '../src/server/mockServer';

describe('music', () => {
  it('rises with the stake and with every step of a multiply run', async () => {
    const server = new MockServer({ balance: 100_000 });
    const model = new RoundModel(server, await server.init());
    expect(musicIntensity(model.state)).toBe(0);
    model.setBet(10_000);
    expect(musicIntensity(model.state)).toBe(1);
    // a typed stake stands between the levels around it
    model.setBet(9_995);
    expect(musicIntensity(model.state)).toBeGreaterThan(0.99);
    model.setBet(1_750);
    expect(musicIntensity(model.state)).toBeCloseTo(2.5 / 5);

    model.setBet(500);
    server.forceOutcomes('sheriff', 'sheriff');
    await model.pick('sheriff');
    model.finishReveal();
    model.finishResult();
    const one = musicIntensity(model.state);
    await model.pick('sheriff');
    model.finishReveal();
    model.finishResult();
    expect(one).toBeCloseTo(0.25);
    expect(musicIntensity(model.state)).toBeGreaterThan(one);
  });

  it('plays calm alone at low stakes, intense alone at high ones, at equal power between', () => {
    expect(musicMix(0).gains).toEqual({ calm: 1, hot: 0 });
    expect(musicMix(1).gains.calm).toBeCloseTo(0);
    expect(musicMix(1).gains.hot).toBeCloseTo(1);
    const { calm, hot } = musicMix(0.5).gains;
    expect(calm ** 2 + (hot / 0.9) ** 2).toBeCloseTo(1);
  });

  it('muffles the lowest stakes', () => {
    expect(musicMix(0).cutoffHz).toBe(2600);
    expect(musicMix(1).cutoffHz).toBe(17600);
  });
});

describe('volumes', () => {
  it('silences everything when muted', () => {
    const v = { muted: true, sfx: 80, music: 80 };
    expect(sfxGain(v)).toBe(0);
    expect(musicGain(v)).toBe(0);
  });

  it('follows the sliders', () => {
    expect(sfxGain({ muted: false, sfx: 50, music: 0 })).toBe(0.5);
    expect(musicGain({ muted: false, sfx: 0, music: 100 })).toBeCloseTo(0.9);
    expect(musicGain({ muted: false, sfx: 0, music: 50 })).toBeLessThan(0.45);
  });
});

describe('pickFile', () => {
  it('takes the first format the browser plays', () => {
    const files = { ogg: 'a.ogg', m4a: 'a.m4a' };
    expect(pickFile(files, () => true)).toBe('a.ogg');
    expect(pickFile(files, (mime) => mime.startsWith('audio/mp4'))).toBe('a.m4a');
    expect(pickFile(files, () => false)).toBeNull();
  });
});

describe('ricochets', () => {
  it('never plays the same one twice running, and uses all of them', () => {
    const played: string[] = [];
    const audio = {
      ctx: null,
      sfx: null,
      audible: true,
      play: (name: string) => (played.push(name), true),
      clipLength: () => 0,
    } as unknown as AudioManager;
    const sounds = new GameSounds(audio);
    for (let i = 0; i < 2000; i++) sounds.lose();
    expect(played.some((name, i) => i > 0 && name === played[i - 1])).toBe(false);
    expect(new Set(played).size).toBe(17);
  });
});
