/**
 * Boot: read the launch URL, connect to the server, then start the scene and the interface.
 */
import { render, h } from 'preact';
import { MockServer } from './server/mockServer';
import type { GameServer } from './server/protocol';
import { readLaunchParams } from './shell/launchParams';
import { createSettings } from './shell/settings';
import { GameScene } from './game/scene/GameScene';
import { RoundModel } from './game/model/RoundModel';
import { startDirector } from './game/director';
import { App } from './game/ui/App';
import './styles.css';

async function boot(): Promise<void> {
  const params = readLaunchParams();
  // the provider adapter replaces MockServer here once its SDK is known
  const server: GameServer = new MockServer({ store: localStorage, latencyMs: 150 });
  const scene = new GameScene();
  const settings = createSettings();
  if (params.debug) Object.assign(window, { hnf: { server, scene, settings } });

  const model = new RoundModel(server, await server.init());
  await scene.mount(byId('scene'));
  startDirector(model, scene, settings);
  render(
    h(App, {
      model,
      settings,
      lang: params.lang,
      demo: params.mode === 'demo',
      onTurnCoin: () => scene.turnCoin(),
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
