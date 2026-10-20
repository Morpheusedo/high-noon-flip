/**
 * Boot: read the launch URL, load the text, the server session and the art behind
 * the loading screen, then start the scene and the interface.
 */
import { render, h } from 'preact';
import { MockServer, type MockServerOptions } from './server/mockServer';
import { ServerError, type GameServer } from './server/protocol';
import { isQaServer } from './server/qa';
import { assetUrl } from './shell/assets';
import { errorScreen, goToLobby } from './shell/errors';
import { AudioManager } from './shell/audio/AudioManager';
import { readLaunchParams, type LaunchParams } from './shell/launchParams';
import { LoadProgress, loadFonts, loaderScreen, preloadImages } from './shell/loader';
import { createSettings, type Settings } from './shell/settings';
import { browserStorage } from './shell/storage';
import { Store } from './shell/store';
import { englishText, loadText, type Text } from './locales';
import { Collection, chosenSkin } from './game/collection/Collection';
import { loadCoinManifest } from './game/collection/skins';
import { localCollectionStore } from './game/collection/store';
import { CoinArt } from './game/scene/coinArt';
import { GameScene } from './game/scene/GameScene';
import { RoundModel } from './game/model/RoundModel';
import { startDirector } from './game/director';
import { GameSounds, startMusicDirector } from './game/sound';
import { createLastBet, savedBet, withBet } from './game/lastBet';
import { CALM, type Tension } from './game/tension';
import { App } from './game/ui/App';
import { UI_ART } from './game/ui/art';
import { TextContext } from './game/ui/text';
import './styles.css';

/** The faces the interface uses, so it does not first draw in a fallback font. */
const FONTS = [
  '1em Rye',
  '1em "Alfa Slab One"',
  '400 1em Barlow',
  '600 1em Barlow',
  '700 1em Barlow',
];

const loader = loaderScreen(byId('loader'));
/** English until the player's language arrives: the loading error needs some text. */
let text: Text = englishText();
/** The operator's lobby, once the launch URL is read: a session error at load leads there. */
let lobbyUrl: string | null = null;

/** The test server's stakes for QA (`bets=levels`, `bets=wide`); the demo's own otherwise. */
function qaStakes(bets: LaunchParams['qaBets']): MockServerOptions {
  if (bets === 'levels') return { config: { customBet: null } };
  // typed amounts too long for a chamber of the dial, in a session of their own
  if (bets === 'wide')
    return {
      config: { customBet: { min: 500, max: 1_000_000_000, step: 1 } },
      balance: 2_000_000_000,
      storeKey: 'hnf.mock-server.wide',
    };
  return {};
}

async function boot(): Promise<void> {
  const params = readLaunchParams();
  lobbyUrl = params.lobbyUrl;
  const progress = new LoadProgress((f) => loader.progress(f));
  // the provider adapter replaces MockServer here once its SDK is known
  const server: GameServer = new MockServer({
    store: browserStorage(),
    latencyMs: 150,
    ...qaStakes(params.qaBets),
  });
  const scene = new GameScene();
  const settings = createSettings(browserStorage());
  const audio = new AudioManager();
  const sounds = new GameSounds(audio);
  // QA's console handles; set before loading, so a failure can be armed for init
  const hnf: Record<string, unknown> | null = params.debug
    ? { server, scene, settings, audio }
    : null;
  if (hnf) Object.assign(window, { hnf });

  audio.listen();
  const applyVolumes = (s: Settings) =>
    audio.setVolumes({ muted: s.muted, sfx: s.sfxVolume, music: s.musicVolume });
  applyVolumes(settings.get());
  settings.subscribe(applyVolumes);

  // the coin collection: only the chosen skin's faces load with the game
  const collectionStore = localCollectionStore(browserStorage());
  const coins = Promise.all([loadCoinManifest(), collectionStore.load()]).then(
    ([manifest, saved]) => [new CoinArt(manifest), manifest, saved] as const,
  );

  // the bar's weights are rough shares of the wait: the art is most of it
  const [loadedText, init] = await Promise.all([
    progress.track(loadText(params.lang), 1).then((t) => {
      text = t;
      document.documentElement.lang = t.lang;
      loader.label(t.t('loader.label'));
      return t;
    }),
    progress.track(server.init(), 2),
    scene.mount(
      byId('scene'),
      coins.then(([art, manifest, saved]) => art.faces(chosenSkin(manifest, saved))),
      progress.add(8),
    ),
    preloadImages(UI_ART, progress.add(4)),
    progress.track(loadFonts(FONTS), 1),
  ]);

  // the last visit's bet, so a returning player can press BET at once
  const lastBet = createLastBet(browserStorage());
  const model = new RoundModel(server, init, savedBet(lastBet.get(), init.config));
  model.store.subscribe((s, previous) => {
    if (s.bet !== previous.bet) lastBet.set(withBet(lastBet.get(), s.bet, s.config));
  });
  // a showdown on the high rungs, which the interface follows by dimming its controls
  const tension = new Store<Tension>(CALM);
  startDirector(model, scene, sounds, settings, tension);
  startMusicDirector(model, audio);
  const [coinArt, manifest, saved] = await coins;
  const collection = new Collection(manifest, saved, collectionStore, init.config.ladder.length);
  collection.watch(model.store);
  // another skin's faces load when it is chosen; the coin keeps its faces until then
  collection.store.subscribe(({ progress: { chosen } }, previous) => {
    if (chosen === previous.progress.chosen) return;
    coinArt
      .faces(chosen)
      .then((faces) => {
        if (collection.state.progress.chosen === chosen) scene.setCoin(faces);
      })
      .catch((err: unknown) => console.warn('The coin keeps its faces', err));
  });
  render(
    h(
      TextContext.Provider,
      { value: loadedText },
      h(App, {
        model,
        settings,
        tension,
        collection,
        lang: params.lang,
        demo: params.mode === 'demo',
        lobbyUrl: params.lobbyUrl,
        sounds,
        onTurnCoin: () => {
          if (scene.turnCoin()) sounds.coinTurn();
        },
      }),
    ),
    byId('ui'),
  );
  loader.hide();
  // Sound starts once the game is up and never holds it: on a slow network its
  // megabyte would take the bandwidth the art needs (docs/LOW_END_CHECK.md).
  void audio.load((file) => assetUrl(`audio/${file}`));

  if (hnf && isQaServer(server)) {
    hnf.model = model;
    hnf.collection = collection;
    // a QA tool that fails to load must not take the game down with it
    import('./debug')
      .then(({ mountQaPanel }) =>
        mountQaPanel({ server, model, lang: params.lang, storage: browserStorage() }),
      )
      .catch((err: unknown) => console.error('QA panel', err));
  }
}

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el;
}

boot().catch((err: unknown) => {
  // a server that refused the session says why, with its way out; anything else is the connection
  if (err instanceof ServerError && err.code !== 'NETWORK') {
    console.warn('The server refused the session', err);
    const { kind, actions } = errorScreen(err.code, true, lobbyUrl !== null);
    const lobby = actions[0] === 'lobby' ? lobbyUrl : null;
    loader.fail(
      text.t(`error.${kind}.title`),
      `${text.t(`error.${kind}.body`)} ${text.t('error.code', { code: err.code })}`,
      text.t(lobby ? 'error.lobby' : 'error.reload'),
      () => (lobby ? goToLobby(lobby) : location.reload()),
    );
    return;
  }
  console.error(err);
  loader.fail(text.t('loader.failed'), text.t('loader.failedHint'), text.t('loader.reload'), () =>
    location.reload(),
  );
});
