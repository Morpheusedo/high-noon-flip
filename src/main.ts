/**
 * Boot: read the launch URL, connect to the server, then start the scene and the interface.
 */
import { render, h } from 'preact';
import { MockServer } from './server/mockServer';
import type { GameServer } from './server/protocol';
import { assetUrl } from './shell/assets';
import { AudioManager } from './shell/audio/AudioManager';
import { readLaunchParams } from './shell/launchParams';
import { createSettings, type Settings } from './shell/settings';
import { GameScene } from './game/scene/GameScene';
import { RoundModel } from './game/model/RoundModel';
import { startDirector } from './game/director';
import { GameSounds, startMusicDirector } from './game/sound';
import { App } from './game/ui/App';
import './styles.css';

async function boot(): Promise<void> {
  const params = readLaunchParams();
  // the provider adapter replaces MockServer here once its SDK is known
  const server: GameServer = new MockServer({ store: localStorage, latencyMs: 150 });
  const scene = new GameScene();
  const settings = createSettings();
  const audio = new AudioManager();
  const sounds = new GameSounds(audio);
  if (params.debug) Object.assign(window, { hnf: { server, scene, settings, audio } });

  // sound loads alongside everything else and never holds the game up
  audio.listen();
  const applyVolumes = (s: Settings) =>
    audio.setVolumes({ muted: s.muted, sfx: s.sfxVolume, music: s.musicVolume });
  applyVolumes(settings.get());
  settings.subscribe(applyVolumes);
  void audio.load((file) => assetUrl(`audio/${file}`));

  const model = new RoundModel(server, await server.init());
  await scene.mount(byId('scene'));
  startDirector(model, scene, sounds, settings);
  startMusicDirector(model, audio);
  render(
    h(App, {
      model,
      settings,
      lang: params.lang,
      demo: params.mode === 'demo',
      sounds,
      onTurnCoin: () => {
        if (scene.turnCoin()) sounds.coinTurn();
      },
    }),
    byId('ui'),
  );
}

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el;
}

boot().catch((err: unknown) => {
  console.error(err);
  document.body.textContent = 'The game could not start. Please reload the page.';
});
