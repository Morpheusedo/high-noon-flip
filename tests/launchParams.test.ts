import { describe, expect, it } from 'vitest';
import { readLaunchParams } from '../src/shell/launchParams';

describe('readLaunchParams', () => {
  it('reads a normal launch URL', () => {
    const p = readLaunchParams(
      '?token=abc&lang=pt-br&mode=real&lobbyUrl=https://casino.example/lobby',
    );
    expect(p).toEqual({
      token: 'abc',
      lang: 'pt-BR',
      mode: 'real',
      lobbyUrl: 'https://casino.example/lobby',
      debug: false,
      qaBets: null,
    });
  });

  it('falls back to safe defaults', () => {
    expect(readLaunchParams('')).toEqual({
      token: '',
      lang: 'en',
      mode: 'demo',
      lobbyUrl: null,
      debug: false,
      qaBets: null,
    });
    expect(readLaunchParams('?lang=%%%').lang).toBe('en');
  });

  it('refuses a lobby URL that would run script', () => {
    expect(readLaunchParams('?lobbyUrl=javascript:alert(1)').lobbyUrl).toBeNull();
  });

  it('never enables the debug panel in a real-money session', () => {
    expect(readLaunchParams('?debug=1').debug).toBe(true);
    expect(readLaunchParams('?debug=1&mode=real').debug).toBe(false);
  });

  it('changes how the test server takes stakes only for QA', () => {
    expect(readLaunchParams('?debug=1&bets=levels').qaBets).toBe('levels');
    expect(readLaunchParams('?debug=1&bets=wide').qaBets).toBe('wide');
    expect(readLaunchParams('?debug=1&bets=other').qaBets).toBeNull();
    expect(readLaunchParams('?bets=levels').qaBets).toBeNull();
    expect(readLaunchParams('?debug=1&mode=real&bets=wide').qaBets).toBeNull();
  });
});
