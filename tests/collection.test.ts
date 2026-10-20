import { describe, expect, it, vi } from 'vitest';
import manifestJson from '../public/assets/images/coins/coins.json';
import en from '../src/locales/en.json';
import { Collection } from '../src/game/collection/Collection';
import { checkManifest, type CoinManifest } from '../src/game/collection/skins';
import { localCollectionStore, readProgress } from '../src/game/collection/store';
import { EMPTY_PROGRESS, count, type CollectionProgress } from '../src/game/collection/unlock';
import { RoundModel } from '../src/game/model/RoundModel';
import { CoinArt } from '../src/game/scene/coinArt';
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
  it('is valid, with the classic coin free and every other one earned by play', () => {
    expect(manifest.skins[0]?.id).toBe('classic');
    expect(manifest.skins.map((s) => s.id)).toEqual([
      'classic',
      'silver',
      'rusty',
      'holed',
      'gold',
      'lucky',
    ]);
    for (const skin of manifest.skins.slice(1)) expect(skin.unlock).not.toBeNull();
  });

  it('names every skin in the dictionary', () => {
    for (const skin of manifest.skins) expect(Object.keys(en)).toContain(`coins.skin.${skin.id}`);
  });

  it('refuses a broken manifest: a stake rule, a bad colour, a locked classic', () => {
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
      'classic',
    );
    expect(broken((m) => m.skins.push({ ...(m.skins[1] as CoinManifest['skins'][0]) }))).toThrow(
      'skins[6].id',
    );
  });
});

describe('unlocking by play', () => {
  it('unlocks Gold when a run reaches rung 5, and tells the player once', async () => {
    const { server, model, collection } = await setup();
    server.forceOutcomes('sheriff', 'sheriff', 'sheriff', 'sheriff');
    for (let i = 0; i < 4; i++) await flip(model);
    expect(collection.isUnlocked('gold')).toBe(false);

    server.forceOutcomes('sheriff');
    await flip(model);
    expect(model.state.openRun?.step).toBe(5);
    expect(collection.isUnlocked('gold')).toBe(true);
    expect(collection.state.news).toEqual(['gold']);
    collection.told('gold');
    expect(collection.state.news).toEqual([]);
  });

  it('counts a run resumed at a high rung from where it stands', async () => {
    const { server, model, collection } = await setup();
    // a QA run opened at rung 5, as the smoke test does: the next win reaches rung 6
    server.openRunAt(5, model.state.bet);
    await model.refresh();
    expect(collection.isUnlocked('gold')).toBe(false);
    server.forceOutcomes('sheriff');
    await flip(model);
    expect(collection.state.progress.runs).toEqual([1, 1, 1, 1, 1, 1]);
    expect(collection.isUnlocked('gold')).toBe(true);
  });

  it('needs three different runs to rung 3 for Rusty', async () => {
    const { server, model, collection } = await setup();
    for (let run = 1; run <= 3; run++) {
      server.forceOutcomes('sheriff', 'sheriff', 'sheriff', 'outlaw');
      for (let i = 0; i < 4; i++) await flip(model);
      expect(collection.isUnlocked('rusty')).toBe(run === 3);
    }
    expect(collection.state.progress.flips).toBe(12);
    expect(collection.state.progress.runs).toEqual([3, 3, 3]);
  });

  it('unlocks the cash out coin at ×15.84 (rung 4) and not below', async () => {
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

  it('counts the top rung, which pays out by itself, as the top and as a cash out', async () => {
    const { server, model, collection } = await setup();
    server.openRunAt(7, model.state.bet);
    await model.refresh();
    server.forceOutcomes('sheriff');
    await flip(model);
    expect(model.state.openRun).toBeNull();
    expect(collection.state.progress.cashout).toBe(8);
    // several unlock at once: they are told in the manifest's order
    expect(collection.state.news).toEqual(['holed', 'gold', 'lucky']);
  });

  it('unlocks Silver after 50 flips, won or lost, whatever the stake', async () => {
    const { server, model, collection } = await setup();
    for (let i = 0; i < 49; i++) {
      // the lowest stake counts as much as the highest
      model.setBet(model.state.config.bets[i % 2 ? 0 : 5] ?? 0);
      server.forceOutcomes('outlaw');
      await flip(model);
    }
    expect(collection.isUnlocked('silver')).toBe(false);
    server.forceOutcomes('outlaw');
    await flip(model);
    expect(collection.isUnlocked('silver')).toBe(true);
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

describe('choosing a coin', () => {
  it('chooses only unlocked coins and saves the choice', async () => {
    const { collection, storage } = await setup({ ...EMPTY_PROGRESS, unlocked: ['silver'] });
    collection.choose('gold');
    expect(collection.chosen.id).toBe('classic');
    collection.choose('silver');
    expect(collection.chosen.id).toBe('silver');
    expect(JSON.parse(storage.getItem('hnf.coins') ?? '{}')).toMatchObject({ chosen: 'silver' });
  });

  it('falls back to the classic coin for a chosen coin that is locked or gone', async () => {
    expect((await setup({ ...EMPTY_PROGRESS, chosen: 'gold' })).collection.chosen.id).toBe(
      'classic',
    );
    const gone = { ...EMPTY_PROGRESS, unlocked: ['platinum'], chosen: 'platinum' };
    expect((await setup(gone)).collection.chosen.id).toBe('classic');
  });

  it('unlocks quietly what a saved progress already earns', async () => {
    const { collection } = await setup({ ...EMPTY_PROGRESS, flips: 80 });
    expect(collection.isUnlocked('silver')).toBe(true);
    expect(collection.state.news).toEqual([]);
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
      unlocked: ['silver'],
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
      }),
    ).toEqual({ ...EMPTY_PROGRESS, runs: [2, 0, 0], unlocked: ['gold'] });
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
