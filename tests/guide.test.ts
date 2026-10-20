import { describe, expect, it } from 'vitest';
import { RoundModel } from '../src/game/model/RoundModel';
import { countRound, hintLevel, nextAction, STRONG_HINT_ROUNDS } from '../src/game/ui/guide';
import { MockServer } from '../src/server/mockServer';

async function setup() {
  const server = new MockServer({ balance: 100_000 });
  return { server, model: new RoundModel(server, await server.init()) };
}

describe('what to press next', () => {
  it('is BET between rounds, a side once BET is pressed, nothing while a round plays', async () => {
    const { server, model } = await setup();
    expect(nextAction(model.state)).toBe('bet');
    model.arm();
    expect(nextAction(model.state)).toBe('side');
    model.disarm();
    expect(nextAction(model.state)).toBe('bet');

    model.arm();
    server.forceOutcomes('sheriff');
    const playing = model.pick('sheriff');
    expect(nextAction(model.state)).toBeNull();
    await playing;
    model.finishReveal();
    model.finishResult();
    // in a run a side flips at once: there is no BET to point at
    expect(model.state.openRun).not.toBeNull();
    expect(nextAction(model.state)).toBeNull();
  });
});

describe('hint level', () => {
  it('points and labels for a first visit and the first three rounds, then only glows', () => {
    expect([0, 1, 2, 3, 10].map(hintLevel)).toEqual([
      'strong',
      'strong',
      'strong',
      'quiet',
      'quiet',
    ]);
  });

  it('counts rounds only as far as the hints change', () => {
    let played = 0;
    for (let i = 0; i < 5; i++) played = countRound(played);
    expect(played).toBe(STRONG_HINT_ROUNDS);
  });
});
