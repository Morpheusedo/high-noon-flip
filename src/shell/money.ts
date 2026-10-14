/**
 * Turning minor units into text a player reads.
 *
 * Every amount in the game is an integer of minor units (see `Minor`). Only
 * this module knows how to show one: how many decimals the currency has, which
 * separators the player's language uses, and where the currency sign goes.
 */
import type { Currency, Minor } from '../server/protocol';

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: Currency, locale: string, withCode: boolean): Intl.NumberFormat {
  const key = `${locale}|${currency.code}|${currency.decimals}|${withCode}`;
  let f = formatters.get(key);
  if (!f) {
    const digits = {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    };
    f =
      withCode && isIsoCurrency(currency.code)
        ? new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency.code,
            currencyDisplay: 'narrowSymbol',
            ...digits,
          })
        : new Intl.NumberFormat(locale, digits);
    formatters.set(key, f);
  }
  return f;
}

/** Minor units as a major-unit number: 19800 cents is 198. */
export function toMajor(amount: Minor, currency: Currency): number {
  return amount / 10 ** currency.decimals;
}

/**
 * A typed amount in major units as minor units: "12.5" EUR is 1250. Takes a dot
 * or a comma as the decimal mark and no group separators. Null for anything
 * else, including more decimals than the currency has.
 */
export function toMinor(text: string, currency: Currency): Minor | null {
  const match = /^(\d+)(?:[.,](\d*))?$/.exec(text.trim());
  if (!match) return null;
  const [, whole = '', fraction = ''] = match;
  if (fraction.length > currency.decimals) return null;
  // in strings, not floats: 0.29 * 100 is 28.999999999999996
  const minor = Number(whole + fraction.padEnd(currency.decimals, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

/**
 * "€198.00", "198,00 €" or "1 980 FUN" depending on the currency and the locale.
 * Play-money and crypto codes that Intl does not know get the code after the number.
 */
export function formatMoney(amount: Minor, currency: Currency, locale: string): string {
  const value = toMajor(amount, currency);
  if (isIsoCurrency(currency.code)) return formatter(currency, locale, true).format(value);
  return `${formatter(currency, locale, false).format(value)} ${currency.code}`;
}

/** The number alone, for places where the currency is shown separately. */
export function formatAmount(amount: Minor, currency: Currency, locale: string): string {
  return formatter(currency, locale, false).format(toMajor(amount, currency));
}

const isoCache = new Map<string, boolean>();

function isIsoCurrency(code: string): boolean {
  let known = isoCache.get(code);
  if (known === undefined) {
    known =
      typeof Intl.supportedValuesOf === 'function' &&
      Intl.supportedValuesOf('currency').includes(code);
    isoCache.set(code, known);
  }
  return known;
}
