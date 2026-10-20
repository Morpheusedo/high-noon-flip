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
 * An amount a player typed, read as their language writes numbers: "1,234.5" in
 * English, "1.234,5" in German, "1 234,5" in Russian. Forgiving where the meaning
 * is clear: a lone mark that cannot be grouping is the decimal mark ("7,35" in
 * English, "7.35" in German or Russian), and trailing zeros past the currency's
 * decimals are dropped ("7.350" EUR). The language's own digits are read too
 * ("٥٫٠٠" in Arabic), as the game prints them. An amount too long to hold exactly
 * reads as the largest that can be held: any stake range caps it anyway. Null for
 * anything else, including a cent the currency does not have ("1.5" JPY): that is
 * not an amount, not a rounding.
 */
export function parseAmount(text: string, currency: Currency, locale: string): Minor | null {
  // spaces (\s takes the no-break ones too) and apostrophes only ever group digits
  const s = latinDigits(text, locale)
    .trim()
    .replace(/[\s'’]/g, ' ');
  if (!/^[\d .,]+$/.test(s) || !/\d/.test(s)) return null;
  const marks = new Set(s.replace(/[\d ]/g, ''));

  let decimalMark: string | null = null;
  if (marks.size === 2) {
    // both: the last one is the decimal mark, the other groups
    decimalMark = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
  } else if (marks.size === 1) {
    const [mark = ''] = [...marks];
    const { decimal, group } = separators(locale);
    const once = s.indexOf(mark) === s.lastIndexOf(mark);
    if (mark === decimal) decimalMark = mark;
    else if (mark === group && isGrouped(s.replaceAll(mark, ' '))) decimalMark = null;
    else if (once) decimalMark = mark;
    else return null;
  }

  const point = decimalMark === null ? -1 : s.lastIndexOf(decimalMark);
  const whole = point < 0 ? s : s.slice(0, point);
  const fraction = point < 0 ? '' : s.slice(point + 1);
  if (!/^\d*$/.test(fraction)) return null;
  // the whole part may group digits, but only in threes ("1 000", not "10 00")
  const grouped = whole.replace(/[.,]/g, ' ');
  if (grouped.includes(' ') && !isGrouped(grouped)) return null;
  const digits = grouped.replaceAll(' ', '');
  if (digits === '' && fraction === '') return null;

  const kept = fraction.replace(/0+$/, '');
  if (kept.length > currency.decimals) return null;
  // in strings, not floats: 0.29 * 100 is 28.999999999999996
  const minor = Number((digits || '0') + kept.padEnd(currency.decimals, '0'));
  return Math.min(minor, Number.MAX_SAFE_INTEGER);
}

/** An amount as a player would type it back: no grouping, the locale's decimal mark. */
export function formatInput(amount: Minor, currency: Currency, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
    useGrouping: false,
  }).format(toMajor(amount, currency));
}

/** "1 000": a first group of 1 to 3 digits, not a lone zero, then threes. */
function isGrouped(s: string): boolean {
  return /^[1-9]\d{0,2}( \d{3})+$/.test(s);
}

interface Numerals {
  /** The locale's digits, 0 to 9; Latin for most languages. */
  digits: string[];
  /** Its marks as typed in Latin text: Arabic's "٫" and "٬" read as "." and ",". */
  decimal: string;
  group: string;
}

const numeralCache = new Map<string, Numerals & { nativeDecimal: string; nativeGroup: string }>();

function numerals(locale: string) {
  let found = numeralCache.get(locale);
  if (!found) {
    const parts = new Intl.NumberFormat(locale).formatToParts(1_234_567.5);
    const nativeDecimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
    const nativeGroup = parts.find((p) => p.type === 'group')?.value ?? ',';
    const latin = (mark: string, fallback: string) => (/^[\s.,'’]$/.test(mark) ? mark : fallback);
    const decimal = latin(nativeDecimal, '.');
    found = {
      digits: [...Array(10).keys()].map((d) => new Intl.NumberFormat(locale).format(d)),
      decimal,
      group: latin(nativeGroup, decimal === '.' ? ',' : '.'),
      nativeDecimal,
      nativeGroup,
    };
    numeralCache.set(locale, found);
  }
  return found;
}

function separators(locale: string): { decimal: string; group: string } {
  const { decimal, group } = numerals(locale);
  return { decimal, group };
}

/** `text` with the locale's own digits and marks in Latin, and no direction marks. */
function latinDigits(text: string, locale: string): string {
  const { digits, decimal, group, nativeDecimal, nativeGroup } = numerals(locale);
  let out = '';
  for (const ch of text.replace(/\p{Cf}/gu, '')) {
    const d = digits.indexOf(ch);
    out += d >= 0 ? String(d) : ch === nativeDecimal ? decimal : ch === nativeGroup ? group : ch;
  }
  return out;
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
