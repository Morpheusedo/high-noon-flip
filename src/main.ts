/**
 * Boot: read the launch URL, connect to the server, then start the scene and the interface.
 */
import { render, h } from 'preact';
import { MockServer } from './server/mockServer';
import type { GameServer } from './server/protocol';
import { readLaunchParams } from './shell/launchParams';
import { GameScene } from './game/scene/GameScene';
import { App } from './game/ui/App';
import './styles.css';

async function boot(): Promise<void> {
  const params = readLaunchParams();
  // the provider adapter replaces MockServer here once its SDK is known
  const server: GameServer = new MockServer({ store: localStorage, latencyMs: 150 });
  if (params.debug) Object.assign(window, { hnf: { server } });

  const init = await server.init();
  await new GameScene().mount(byId('scene'));
  render(h(App, { init, lang: params.lang }), byId('ui'));
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
