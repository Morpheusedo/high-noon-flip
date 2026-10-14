import { describe, expect, it } from 'vitest';
import { errorScreen } from '../src/shell/errors';
import { LoadProgress } from '../src/shell/loader';
import { DEFAULT_SETTINGS, createSettings, readSettings } from '../src/shell/settings';
import { memoryStore } from '../src/shell/storage';

describe('settings', () => {
  it('saves every change and reads it back next session', () => {
    const store = memoryStore();
    const first = createSettings(store);
    first.set({ ...first.get(), speed: 4, sfxVolume: 40, muted: true });
    expect(createSettings(store).get()).toEqual({
      ...DEFAULT_SETTINGS,
      speed: 4,
      sfxVolume: 40,
      muted: true,
    });
  });

  it('takes the default for anything odd in a saved value', () => {
    expect(
      readSettings({ speed: 3, muted: 'yes', sfxVolume: 250, musicVolume: Number.NaN }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      sfxVolume: 100,
    });
    expect(readSettings('garbage')).toEqual(DEFAULT_SETTINGS);
    const store = memoryStore();
    store.setItem('hnf.settings', '{not json');
    expect(createSettings(store).get()).toEqual(DEFAULT_SETTINGS);
  });

  it('works without storage', () => {
    const s = createSettings(null);
    s.set({ ...s.get(), speed: 2 });
    expect(s.get().speed).toBe(2);
  });
});

describe('load progress', () => {
  it('weighs the tasks and never moves back', async () => {
    const seen: number[] = [];
    const progress = new LoadProgress((f) => seen.push(f));
    const art = progress.add(3);
    let finish: (v: string) => void = () => undefined;
    const init = progress.track(new Promise<string>((r) => (finish = r)), 1);
    art(0.5);
    art(0.2);
    art(1);
    finish('ok');
    expect(await init).toBe('ok');
    expect(seen).toEqual([0.375, 0.75, 1]);
  });
});

describe('error screens', () => {
  it('offers a retry for a lost connection and a way on for the rest', () => {
    expect(errorScreen('NETWORK', false, true)).toEqual({ kind: 'network', actions: ['retry'] });
    expect(errorScreen('ROUND_IN_PROGRESS', false, true)).toEqual({
      kind: 'roundInProgress',
      actions: ['continue'],
    });
  });

  it('sends a fatal error to the lobby, or offers a reload where there is none', () => {
    expect(errorScreen('SESSION_EXPIRED', true, true).actions).toEqual(['lobby', 'reload']);
    expect(errorScreen('SESSION_EXPIRED', true, false).actions).toEqual(['reload']);
  });

  it('treats a code it does not know as a general error', () => {
    const code = 'RATE_LIMITED' as Parameters<typeof errorScreen>[0];
    expect(errorScreen(code, false, false).kind).toBe('internal');
  });
});
