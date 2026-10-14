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
    });
  });

  it('falls back to safe defaults', () => {
    expect(readLaunchParams('')).toEqual({
      token: '',
      lang: 'en',
      mode: 'demo',
      lobbyUrl: null,
      debug: false,
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
});
