/**
 * Boot: read the launch URL, load the text, the server session and the art behind
 * the loading screen, then start the scene and the interface.
 */
import { render, h } from 'preact';
import { MockServer } from './server/mockServer';
import type { GameServer } from './server/protocol';
import { isQaServer } from './server/qa';
import { assetUrl } from './shell/assets';
import { AudioManager } from './shell/audio/AudioManager';
import { readLaunchParams } from './shell/launchParams';
import { LoadProgress, loadFonts, loaderScreen } from './shell/loader';
import { createSettings, type Settings } from './shell/settings';
import { browserStorage } from './shell/storage';
import { englishText, loadText, type Text } from './locales';
import { GameScene } from './game/scene/GameScene';
import { RoundModel } from './game/model/RoundModel';
import { startDirector } from './game/director';
import { GameSounds, startMusicDirector } from './game/sound';
import { App } from './game/ui/App';
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

async function boot(): Promise<void> {
  const params = readLaunchParams();
  const progress = new LoadProgress((f) => loader.progress(f));
  // the provider adapter replaces MockServer here once its SDK is known
  const server: GameServer = new MockServer({ store: browserStorage(), latencyMs: 150 });
  const scene = new GameScene();
  const settings = createSettings(browserStorage());
  const audio = new AudioManager();
  const sounds = new GameSounds(audio);
  // QA's console handles; set before loading, so a failure can be armed for init
  const hnf: Record<string, unknown> | null = params.debug
    ? { server, scene, settings, audio }
    : null;
  if (hnf) Object.assign(window, { hnf });

  // sound loads alongside everything else and never holds the game up
  audio.listen();
  const applyVolumes = (s: Settings) =>
    audio.setVolumes({ muted: s.muted, sfx: s.sfxVolume, music: s.musicVolume });
  applyVolumes(settings.get());
  settings.subscribe(applyVolumes);
  void audio.load((file) => assetUrl(`audio/${file}`));

  // the bar's weights are rough shares of the wait: the art is most of it
  const [loadedText, init] = await Promise.all([
    progress.track(loadText(params.lang), 1).then((t) => {
      text = t;
      document.documentElement.lang = t.lang;
      loader.label(t.t('loader.label'));
      return t;
    }),
    progress.track(server.init(), 2),
    scene.mount(byId('scene'), progress.add(8)),
    progress.track(loadFonts(FONTS), 1),
  ]);

  const model = new RoundModel(server, init);
  startDirector(model, scene, sounds, settings);
  startMusicDirector(model, audio);
  render(
    h(
      TextContext.Provider,
      { value: loadedText },
      h(App, {
        model,
        settings,
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

  if (hnf && isQaServer(server)) {
    hnf.model = model;
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
  console.error(err);
  loader.fail(text.t('loader.failed'), text.t('loader.failedHint'), text.t('loader.reload'), () =>
    location.reload(),
  );
});
