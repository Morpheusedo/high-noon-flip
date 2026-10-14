import { describe, expect, it } from 'vitest';
import { formatAmount, formatMoney } from '../src/shell/money';

// Intl puts no-break spaces between groups and before some signs
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('formatMoney', () => {
  it('formats euros for English and German players', () => {
    const eur = { code: 'EUR', decimals: 2 };
    expect(formatMoney(19_800, eur, 'en')).toBe('€198.00');
    expect(plain(formatMoney(19_800, eur, 'de'))).toBe('198,00 €');
  });

  it('respects currencies without decimals', () => {
    expect(formatMoney(1500, { code: 'JPY', decimals: 0 }, 'en')).toBe('¥1,500');
  });

  it('puts the code after unknown and play-money currencies', () => {
    expect(formatMoney(12_345, { code: 'BTC', decimals: 8 }, 'en')).toBe('0.00012345 BTC');
    expect(formatMoney(100_000, { code: 'FUN', decimals: 2 }, 'en')).toBe('1,000.00 FUN');
  });

  it('formats the bare amount', () => {
    expect(formatAmount(250, { code: 'EUR', decimals: 2 }, 'en')).toBe('2.50');
  });
});
