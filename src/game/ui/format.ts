/** Number formats the interface needs on top of `shell/money.ts`. */
import type { Currency, Minor } from '../../server/protocol';
import { formatAmount, formatInput, formatMoney, parseAmount, toMajor } from '../../shell/money';

export interface Formats {
  /** The number alone: "1,000.00". */
  amount(value: Minor): string;
  /** As short as it can be: "1", "2.50", "10K"; for bullets and buttons. */
  short(value: Minor): string;
  /** The amount with its currency, for screen readers: "€2.50", "1.00 FUN". */
  full(value: Minor): string;
  /** The currency code shown small next to an amount. */
  code: string;
  /** As a player would type it: "7.35", "7,35". */
  input(value: Minor): string;
  /** What a player typed, in their language's way of writing numbers; null if it is not an amount. */
  parse(text: string): Minor | null;
  /** "×1.98", "×15.8", "×253": fewer decimals as the number grows. */
  multiplier(value: number): string;
  /** "×15.84", "×253.44": every decimal the payout has, for the rules. */
  exactMultiplier(value: number): string;
  /** A chance as a share: 0.5 is "50%". */
  percent(value: number): string;
}

export function formats(currency: Currency, lang: string): Formats {
  const digits = (n: number) =>
    new Intl.NumberFormat(lang, { maximumFractionDigits: n, minimumFractionDigits: n });
  const two = digits(2);
  const one = digits(1);
  const none = digits(0);
  const exact = new Intl.NumberFormat(lang, { maximumFractionDigits: 4 });
  const compact = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 });
  const share = new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 2 });
  return {
    amount: (value) => formatAmount(value, currency, lang),
    short: (value) => {
      const major = toMajor(value, currency);
      if (major >= 10_000) return compact.format(major);
      return Number.isInteger(major) ? none.format(major) : formatAmount(value, currency, lang);
    },
    full: (value) => formatMoney(value, currency, lang),
    code: currency.code,
    input: (value) => formatInput(value, currency, lang),
    parse: (text) => parseAmount(text, currency, lang),
    multiplier: (value) => `×${(value < 10 ? two : value < 100 ? one : none).format(value)}`,
    exactMultiplier: (value) => `×${exact.format(value)}`,
    percent: (value) => share.format(value),
  };
}
