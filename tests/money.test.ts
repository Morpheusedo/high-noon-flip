import { describe, expect, it } from 'vitest';
import { formatAmount, formatInput, formatMoney, parseAmount, toMinor } from '../src/shell/money';

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

describe('parseAmount', () => {
  const fun = { code: 'FUN', decimals: 2 };
  const jpy = { code: 'JPY', decimals: 0 };
  const btc = { code: 'BTC', decimals: 8 };

  it('reads English: a dot for decimals, commas between thousands', () => {
    expect(parseAmount('7.35', fun, 'en')).toBe(735);
    expect(parseAmount('1,000', fun, 'en')).toBe(100_000);
    expect(parseAmount('1,234.5', fun, 'en')).toBe(123_450);
    expect(parseAmount('12,345,678.90', fun, 'en')).toBe(1_234_567_890);
  });

  it('reads German: a comma for decimals, dots between thousands', () => {
    expect(parseAmount('7,35', fun, 'de')).toBe(735);
    expect(parseAmount('1.000', fun, 'de')).toBe(100_000);
    expect(parseAmount('1.234,5', fun, 'de')).toBe(123_450);
  });

  it('reads Russian: a comma for decimals, spaces between thousands', () => {
    expect(parseAmount('7,35', fun, 'ru')).toBe(735);
    expect(parseAmount('1 234,5', fun, 'ru')).toBe(123_450);
    // as Intl writes it, with a no-break space
    expect(parseAmount(formatAmount(123_450, fun, 'ru'), fun, 'ru')).toBe(123_450);
  });

  it('takes the other mark as the decimal one where it cannot group digits', () => {
    // a phone keyboard offers the device's mark, not the game's
    expect(parseAmount('7,35', fun, 'en')).toBe(735);
    expect(parseAmount('7.35', fun, 'de')).toBe(735);
    expect(parseAmount('7.35', fun, 'ru')).toBe(735);
    expect(parseAmount('0,5', fun, 'en')).toBe(50);
  });

  it('keeps to the currency decimals', () => {
    expect(parseAmount('1,500', jpy, 'en')).toBe(1500);
    expect(parseAmount('1500', jpy, 'ru')).toBe(1500);
    expect(parseAmount('1.5', jpy, 'en')).toBeNull();
    expect(parseAmount('0.00012345', btc, 'en')).toBe(12_345);
    expect(parseAmount('0,00012345', btc, 'ru')).toBe(12_345);
    expect(parseAmount('0,001', btc, 'en')).toBe(100_000);
    expect(parseAmount('0.000000001', btc, 'en')).toBeNull();
    expect(parseAmount('7.351', fun, 'en')).toBeNull();
    // zeros past the decimals change nothing
    expect(parseAmount('7.350', fun, 'en')).toBe(735);
  });

  it('refuses what is not an amount', () => {
    for (const bad of ['', ' ', '.', '-1', 'abc', '1e3', '7.3.5', '10 00', '1,00,000', '1 0,5'])
      expect(parseAmount(bad, fun, 'en'), bad).toBeNull();
  });
});

describe('formatInput', () => {
  it('writes an amount back as a player types it', () => {
    const fun = { code: 'FUN', decimals: 2 };
    expect(formatInput(123_450, fun, 'en')).toBe('1234.50');
    expect(formatInput(735, fun, 'ru')).toBe('7,35');
    expect(formatInput(1500, { code: 'JPY', decimals: 0 }, 'de')).toBe('1500');
  });
});
