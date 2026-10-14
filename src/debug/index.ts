/**
 * The QA panel, loaded only with `debug=1` in demo mode. main.ts imports this
 * module dynamically, so the panel is its own chunk and a player's session
 * never downloads it.
 */
import { h, render } from 'preact';
import type { QaServer } from '../server/qa';
import type { KeyValueStore } from '../shell/storage';
import type { RoundModel } from '../game/model/RoundModel';
import { QaPanel } from './QaPanel';

export interface QaDeps {
  server: QaServer;
  model: RoundModel;
  lang: string;
  storage: KeyValueStore | null;
}

/** Puts the panel in its own root next to the game, outside the stage. */
export function mountQaPanel(deps: QaDeps): void {
  const root = document.createElement('div');
  root.id = 'qa';
  document.body.append(root);
  render(h(QaPanel, deps), root);
}
