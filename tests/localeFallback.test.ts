import { expect, it, vi } from 'vitest';

// a language chunk that never arrives: offline, or gone after a redeploy
vi.mock('../src/locales/ru.json', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

it('falls back to English when the language does not arrive', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { loadText } = await import('../src/locales');
  const text = await loadText('ru');
  expect(text.lang).toBe('en');
  expect(text.t('cashOut')).toBe('Cash out');
  expect(warn).toHaveBeenCalled();
});
