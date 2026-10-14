import { describe, expect, it } from 'vitest';
import { formatAmount, formatMoney, toMinor } from '../src/shell/money';

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

describe('toMinor', () => {
  const eur = { code: 'EUR', decimals: 2 };

  it('reads a dot or a comma as the decimal mark', () => {
    expect(toMinor('12.5', eur)).toBe(1250);
    expect(toMinor('12,05', eur)).toBe(1205);
    expect(toMinor(' 7 ', eur)).toBe(700);
    expect(toMinor('7.', eur)).toBe(700);
  });

  it('stays exact where floats are not', () => {
    expect(toMinor('0.29', eur)).toBe(29);
    expect(toMinor('0.00012345', { code: 'BTC', decimals: 8 })).toBe(12_345);
  });

  it('refuses more decimals than the currency has, and anything not a plain amount', () => {
    expect(toMinor('1.5', { code: 'JPY', decimals: 0 })).toBeNull();
    expect(toMinor('1.234', eur)).toBeNull();
    for (const bad of ['', '-1', '1,000.00', 'abc', '1e3', '.5'])
      expect(toMinor(bad, eur)).toBeNull();
  });
});
