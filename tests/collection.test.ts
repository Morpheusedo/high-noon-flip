import { describe, expect, it, vi } from 'vitest';
import manifestJson from '../public/assets/images/coins/coins.json';
import en from '../src/locales/en.json';
import { Collection, settle } from '../src/game/collection/Collection';
import { checkManifest, type CoinManifest } from '../src/game/collection/skins';
import { localCollectionStore, readProgress } from '../src/game/collection/store';
import {
  EMPTY_PROGRESS,
  count,
  nextCoin,
  type CollectionProgress,
} from '../src/game/collection/unlock';
import { RoundModel } from '../src/game/model/RoundModel';
import { CoinArt } from '../src/game/scene/coinArt';
import { nextText } from '../src/game/ui/Coins';
import { formats } from '../src/game/ui/format';
import { englishText, loadText } from '../src/locales';
import { MockServer } from '../src/server/mockServer';
import { memoryStore } from '../src/shell/storage';

// the coin art test passes its own loader; Pixi itself needs a browser
vi.mock('pixi.js', () => ({ Assets: {} }));

const manifest = checkManifest(structuredClone(manifestJson));

async function setup(saved: CollectionProgress = EMPTY_PROGRESS) {
  const server = new MockServer({ balance: 1_000_000 });
  const model = new RoundModel(server, await server.init());
  const storage = memoryStore();
  const collection = new Collection(
    manifest,
    saved,
    localCollectionStore(storage),
    model.state.config.ladder.length,
  );
  collection.watch(model.store);
  return { server, model, collection, storage };
}

/** One pick, played to its result and back to idle, as the director would. */
async function flip(model: RoundModel) {
  await model.pick('sheriff');
  model.finishReveal();
  model.finishResult();
}

async function cashOut(model: RoundModel) {
  await model.cashOut();
  model.finishResult();
}

describe('the coin manifest', () => {
  it('is a path from the rusty coin to gold, each coin after the first earned by play', () => {
    expect(manifest.skins.map((s) => s.id)).toEqual([
      'rusty',
      'classic',
      'silver',
      'holed',
      'gold',
    ]);
    // the start and the fallback are two roles: rusty is worn first, classic stands in for missing art
    expect(manifest.start).toBe('rusty');
    expect(manifest.classic).toBe('classic');
    expect(manifest.skins[0]?.unlock).toBeNull();
    for (const skin of manifest.skins.slice(1)) expect(skin.unlock).not.toBeNull();
    expect(manifest.skins.map((s) => s.unlock)).toEqual([
      null,
      { flips: 10 },
      { rung: 3, runs: 3 },
      { cashout: 4 },
      { rung: 7 },
    ]);
  });

  it('names every skin and every earned title in the dictionary', () => {
    for (const skin of manifest.skins) {
      expect(Object.keys(en)).toContain(`coins.skin.${skin.id}`);
      if (skin.unlock) expect(Object.keys(en)).toContain(`coins.rank.${skin.id}`);
    }
  });

  it('refuses a broken manifest: a stake rule, a bad colour, a start that must be earned', () => {
    const broken = (patch: (m: CoinManifest) => void) => {
      const m = structuredClone(manifestJson) as unknown as CoinManifest;
      patch(m);
      return () => checkManifest(m);
    };
    expect(broken((m) => Object.assign(m.skins[1] ?? {}, { unlock: { stake: 100 } }))).toThrow(
      'skins[1].unlock',
    );
    expect(
      broken((m) => Object.assign(m.skins[1] ?? {}, { rim: ['red', '#000000', '#000000'] })),
    ).toThrow('skins[1].rim');
    expect(broken((m) => Object.assign(m.skins[0] ?? {}, { unlock: { flips: 1 } }))).toThrow(
      'start',
    );
    expect(broken((m) => Object.assign(m, { classic: 'lucky' }))).toThrow('classic');
    expect(broken((m) => m.skins.push({ ...(m.skins[1] as CoinManifest['skins'][0]) }))).toThrow(
      'skins[5].id',
    );
  });
});

describe('unlocking by play', () => {
  it('starts a new player with the rusty coin, owned and worn', async () => {
    const { collection, storage } = await setup();
    expect(collection.chosen.id).toBe('rusty');
    expect(collection.isUnlocked('rusty')).toBe(true);
    expect(collection.isUnlocked('classic')).toBe(false);
    expect(collection.state.progress.unlocked).toEqual(['rusty']);
    expect(collection.state.news).toEqual([]);
    expect(JSON.parse(storage.getItem('hnf.coins') ?? '{}')).toMatchObject({
      v: 2,
      chosen: 'rusty',
      unlocked: ['rusty'],
    });
  });

  it('unlocks Classic (Rookie) after 10 flips, won or lost, whatever the stake', async () => {
    const { server, model, collection } = await setup();
    for (let i = 0; i < 9; i++) {
      // the lowest stake counts as much as the highest
      model.setBet(model.state.config.bets[i % 2 ? 0 : 5] ?? 0);
      server.forceOutcomes('outlaw');
      await flip(model);
    }
    expect(collection.isUnlocked('classic')).toBe(false);
    server.forceOutcomes('outlaw');
    await flip(model);
    expect(collection.isUnlocked('classic')).toBe(true);
    expect(collection.state.news).toEqual(['classic']);
    // unlocking does not change the coin the player wears
    expect(collection.chosen.id).toBe('rusty');
  });

  it('needs three different runs to rung 3 for Silver (Old hand)', async () => {
    const { server, model, collection } = await setup();
    for (let run = 1; run <= 3; run++) {
      server.forceOutcomes('sheriff', 'sheriff', 'sheriff', 'outlaw');
      for (let i = 0; i < 4; i++) await flip(model);
      expect(collection.isUnlocked('silver')).toBe(run === 3);
    }
    expect(collection.state.progress.flips).toBe(12);
    expect(collection.state.progress.runs).toEqual([3, 3, 3]);
    // 12 flips earned Classic on the way
    expect(collection.state.news).toEqual(['classic', 'silver']);
  });

  it('unlocks the bullet-holed coin at a cash out of ×15.84 (rung 4) and not below', async () => {
    const { server, model, collection } = await setup();
    server.forceOutcomes('sheriff', 'sheriff', 'sheriff');
    for (let i = 0; i < 3; i++) await flip(model);
    await cashOut(model);
    expect(collection.state.progress.cashout).toBe(3);
    expect(collection.isUnlocked('holed')).toBe(false);

    server.forceOutcomes('sheriff', 'sheriff', 'sheriff', 'sheriff');
    for (let i = 0; i < 4; i++) await flip(model);
    await cashOut(model);
    expect(collection.isUnlocked('holed')).toBe(true);
  });

  it('unlocks Gold (Legend) when a run reaches rung 7, and tells the player once', async () => {
    const { server, model, collection } = await setup();
    server.openRunAt(5, model.state.bet);
    await model.refresh();
    server.forceOutcomes('sheriff');
    await flip(model);
    expect(model.state.openRun?.step).toBe(6);
    expect(collection.isUnlocked('gold')).toBe(false);

    server.forceOutcomes('sheriff');
    await flip(model);
    expect(model.state.openRun?.step).toBe(7);
    expect(collection.isUnlocked('gold')).toBe(true);
    expect(collection.state.news).toEqual(['gold']);
    collection.told('gold');
    expect(collection.state.news).toEqual([]);
  });

  it('counts a run resumed at a high rung from where it stands', async () => {
    const { server, model, collection } = await setup();
    // a QA run opened at rung 6, as the smoke test may: the next win reaches rung 7
    server.openRunAt(6, model.state.bet);
    await model.refresh();
    expect(collection.isUnlocked('gold')).toBe(false);
    server.forceOutcomes('sheriff');
    await flip(model);
    expect(collection.state.progress.runs).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(collection.isUnlocked('gold')).toBe(true);
  });

  it('counts the top rung, which pays out by itself, as a rung and as a cash out', async () => {
    const { server, model, collection } = await setup();
    server.openRunAt(7, model.state.bet);
    await model.refresh();
    server.forceOutcomes('sheriff');
    await flip(model);
    expect(model.state.openRun).toBeNull();
    expect(collection.state.progress.cashout).toBe(8);
    // several unlock at once: they are told in the path's order
    expect(collection.state.news).toEqual(['holed', 'gold']);
  });

  it('counts nothing for an answer lost on the way (NETWORK) or a refresh', async () => {
    const { server, model, collection } = await setup();
    server.failNext('NETWORK', 'after');
    await model.pick('sheriff');
    await model.dismissError();
    await model.refresh();
    expect(collection.state.progress.flips).toBe(0);
  });

  it('a resumed run counted before is not counted again', () => {
    let p = count(EMPTY_PROGRESS, [{ kind: 'flip', round: 'r1', rung: 3 }]);
    p = count(p, [{ kind: 'flip', round: 'r1', rung: 3 }]);
    expect(p.runs).toEqual([1, 1, 1]);
    p = count(p, [{ kind: 'flip', round: 'r2', rung: 1 }]);
    expect(p.runs).toEqual([2, 1, 1]);
  });
});

describe('the next coin', () => {
  const next = (p: Partial<CollectionProgress>) => {
    const n = nextCoin(manifest, settle(manifest, { ...EMPTY_PROGRESS, ...p }, 8), 8);
    return n && { id: n.skin.id, done: n.done, goal: n.goal };
  };

  it('is the first coin still locked on the path, with how far the player is', () => {
    expect(next({})).toEqual({ id: 'classic', done: 0, goal: 10 });
    expect(next({ flips: 4 })).toEqual({ id: 'classic', done: 4, goal: 10 });
    expect(next({ flips: 14, runs: [3, 2, 2] })).toEqual({ id: 'silver', done: 2, goal: 3 });
    // a cash out and a rung count the best so far towards the rung they name
    const silver = { flips: 30, runs: [5, 4, 3] };
    expect(next({ ...silver, cashout: 2 })).toEqual({ id: 'holed', done: 2, goal: 4 });
    expect(next({ ...silver, runs: [5, 4, 3, 2, 1], cashout: 4 })).toEqual({
      id: 'gold',
      done: 5,
      goal: 7,
    });
  });

  it('is none with every coin collected', () => {
    expect(next({ flips: 90, runs: [9, 8, 7, 6, 5, 4, 1], cashout: 5 })).toBeNull();
  });

  it('skips a coin already owned out of order', () => {
    // a coin unlocked under an older rule stays unlocked: the path moves past it
    expect(next({ flips: 12, unlocked: ['silver'] })).toEqual({ id: 'holed', done: 0, goal: 4 });
  });
});

describe('choosing a coin', () => {
  it('chooses only unlocked coins and saves the choice', async () => {
    const { collection, storage } = await setup({ ...EMPTY_PROGRESS, unlocked: ['silver'] });
    collection.choose('gold');
    expect(collection.chosen.id).toBe('rusty');
    collection.choose('silver');
    expect(collection.chosen.id).toBe('silver');
    expect(JSON.parse(storage.getItem('hnf.coins') ?? '{}')).toMatchObject({ chosen: 'silver' });
  });

  it('falls back to the rusty coin for a chosen coin that is locked or gone', async () => {
    expect((await setup({ ...EMPTY_PROGRESS, chosen: 'gold' })).collection.chosen.id).toBe('rusty');
    const gone = { ...EMPTY_PROGRESS, unlocked: ['platinum'], chosen: 'platinum' };
    const { collection } = await setup(gone);
    expect(collection.chosen.id).toBe('rusty');
    expect(collection.state.progress.unlocked).toEqual(['rusty']);
  });

  it('unlocks quietly what a saved progress already earns', async () => {
    const { collection } = await setup({ ...EMPTY_PROGRESS, flips: 80 });
    expect(collection.isUnlocked('classic')).toBe(true);
    expect(collection.state.news).toEqual([]);
  });
});

describe('progress saved before the rusty start (version 1)', () => {
  /** What step 22 saved: no version, the classic coin unlisted and worn by everyone. */
  const v1 = (patch: Record<string, unknown>) => {
    const storage = memoryStore();
    storage.setItem(
      'hnf.coins',
      JSON.stringify({ flips: 3, runs: [1], cashout: 0, run: null, unlocked: [], ...patch }),
    );
    return localCollectionStore(storage).load();
  };

  it('keeps the classic coin a player wore, and adds the rusty one', async () => {
    const { collection } = await setup(await v1({ chosen: 'classic' }));
    expect(collection.chosen.id).toBe('classic');
    expect(collection.isUnlocked('classic')).toBe(true);
    expect(collection.state.progress.unlocked).toEqual(['rusty', 'classic']);
    expect(collection.state.news).toEqual([]);
    expect(collection.next?.skin.id).toBe('silver');
  });

  it('keeps coins unlocked under the old rules', async () => {
    const { collection } = await setup(await v1({ unlocked: ['rusty', 'gold'], chosen: 'gold' }));
    expect(collection.chosen.id).toBe('gold');
    expect(collection.state.progress.unlocked).toEqual(['classic', 'rusty', 'gold']);
  });

  it('drops Lucky, chosen or unlocked: it comes back only when the server grants it', async () => {
    const { collection, storage } = await setup(
      await v1({ unlocked: ['silver', 'lucky'], chosen: 'lucky' }),
    );
    expect(collection.chosen.id).toBe('rusty');
    expect(collection.isUnlocked('lucky')).toBe(false);
    expect(collection.state.progress.unlocked).toEqual(['rusty', 'classic', 'silver']);
    // and the save no longer names it
    expect(storage.getItem('hnf.coins')).not.toContain('lucky');
  });
});

describe('the collection store', () => {
  it('saves and reads the progress back', async () => {
    const storage = memoryStore();
    const store = localCollectionStore(storage);
    const progress: CollectionProgress = {
      flips: 12,
      runs: [3, 2, 1],
      cashout: 2,
      run: { id: 'r9', best: 3 },
      unlocked: ['rusty', 'silver'],
      chosen: 'silver',
    };
    await store.save(progress);
    expect(await localCollectionStore(storage).load()).toEqual(progress);
  });

  it('reads corrupt or odd data as an empty collection, field by field', async () => {
    const storage = memoryStore();
    storage.setItem('hnf.coins', '{not json');
    expect(await localCollectionStore(storage).load()).toEqual(EMPTY_PROGRESS);
    expect(readProgress('garbage')).toEqual(EMPTY_PROGRESS);
    expect(
      readProgress({
        flips: -3,
        runs: [2, 'x', 1.5],
        cashout: Number.NaN,
        run: { id: 7, best: 2 },
        unlocked: ['gold', 4, 'gold'],
        chosen: null,
        v: 2,
      }),
    ).toEqual({ ...EMPTY_PROGRESS, runs: [2, 0, 0], unlocked: ['gold'] });
    // the empty value is never changed by a read
    readProgress({ unlocked: 'x' });
    expect(EMPTY_PROGRESS.unlocked).toEqual([]);
  });

  it('works when storage is blocked', async () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
    };
    const store = localCollectionStore(blocked);
    await store.save({ ...EMPTY_PROGRESS, flips: 3 });
    expect(await store.load()).toEqual(EMPTY_PROGRESS);
    expect(await localCollectionStore(null).load()).toEqual(EMPTY_PROGRESS);
  });
});

describe('coin art', () => {
  const texture = (url: string) => ({ url }) as never;

  it('loads a skin’s faces with its rim colours', async () => {
    const load = vi.fn((urls: string[]) => Promise.resolve(urls.map(texture)));
    const faces = await new CoinArt(manifest, load).faces('silver');
    expect(faces.id).toBe('silver');
    expect(faces.sheriff).toEqual({ url: expect.stringContaining('coins/silver-sheriff.webp') });
    expect(faces.rim[1]).toBe(0x969392);
  });

  it('shows the classic coin with a warning when a skin’s art is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const load = vi.fn((urls: string[]) =>
      urls.some((u) => u.includes('gold'))
        ? Promise.reject(new Error('404'))
        : Promise.resolve(urls.map(texture)),
    );
    const art = new CoinArt(manifest, load);
    const faces = await art.faces('gold');
    expect(faces.id).toBe('classic');
    expect(faces.outlaw).toEqual({ url: expect.stringContaining('classic-outlaw.webp') });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Coin "gold": art is missing'),
      expect.anything(),
    );
    // asked again, it does not fetch the missing art a second time
    await art.faces('gold');
    expect(load).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('fails like the rest of the art when the classic coin is missing', async () => {
    const art = new CoinArt(manifest, () => Promise.reject(new Error('404')));
    await expect(art.faces('classic')).rejects.toThrow('404');
  });
});

describe('the next coin, in words', () => {
  const ladder = [1.98, 3.96, 7.92, 15.84, 31.68, 63.36, 126.72, 253.44];
  const say = (p: Partial<CollectionProgress>, text = englishText(), lang = 'en') => {
    const next = nextCoin(manifest, settle(manifest, { ...EMPTY_PROGRESS, ...p }, 8), 8);
    return next && nextText(text, ladder, formats({ code: 'FUN', decimals: 2 }, lang), next);
  };

  it('names the coin and the count, rung or cash out still to go', () => {
    expect(say({ flips: 90, runs: [9, 8, 7, 6, 5, 4, 1], cashout: 5 })).toBeNull();
    expect(say({ flips: 4 })).toBe('Next: Classic, 4 of 10 flips');
    expect(say({ flips: 14, runs: [3, 2, 2] })).toBe('Next: Silver, rung 3 in 2 of 3 runs');
    const silver = { flips: 30, runs: [5, 4, 3] };
    expect(say(silver)).toBe('Next: Bullet-holed, cash out at ×15.8 or higher');
    expect(say({ ...silver, cashout: 3 })).toBe(
      'Next: Bullet-holed, cash out at ×15.8 or higher (best so far: ×7.92)',
    );
    expect(say({ ...silver, runs: [5, 4, 3, 1, 1], cashout: 4 })).toBe(
      'Next: Gold, reach rung 7 (best so far: 5)',
    );
  });

  it('reads in Russian with its plural forms', async () => {
    const ru = await loadText('ru');
    expect(say({ flips: 4 }, ru, 'ru')).toBe('Дальше: Классика — 4 из 10 бросков');
    expect(say({ flips: 14, runs: [3, 1, 1] }, ru, 'ru')).toBe(
      'Дальше: Серебро — 3-я ступень в 1 из 3 серий',
    );
  });
});
