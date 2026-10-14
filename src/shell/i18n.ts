/**
 * Interface text in the player's language. Shared by every game.
 *
 * A dictionary is flat JSON, one key per message:
 *   "rules.bets": "Bets from {min} to {max}."
 * - `{name}` is replaced by a value the game passes in.
 * - A message that depends on a number is an object of plural forms, chosen by
 *   the `count` value with Intl.PluralRules: {"one": "...", "few": "...", "other": "..."}.
 *   Russian needs one, few and many; English needs one and other.
 *
 * A key missing from a language falls back to the base dictionary (English),
 * so a late translation shows English text, never a raw key.
 */

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Message = string | PluralForms;
export type Dictionary = Readonly<Record<string, Message>>;

export interface Translator<K extends string> {
  /** The language of the dictionary in use: "ru", or "en" when the requested one is missing. */
  readonly lang: string;
  t(key: K, vars?: Readonly<Record<string, string | number>>): string;
  /**
   * The message split around its placeholders, with the values in place. Values
   * may be anything a view renders, e.g. a bold element: nothing is parsed as HTML.
   */
  parts<T>(key: K, vars: Readonly<Record<string, string | number | T>>): (string | T)[];
}

const PLACEHOLDER = /\{(\w+)\}/g;

export function createTranslator<K extends string>(
  lang: string,
  dictionary: Dictionary,
  base: Readonly<Record<K, Message>>,
): Translator<K> {
  const plural = new Intl.PluralRules(lang);
  const template = (key: K, vars: Readonly<Record<string, unknown>>): string => {
    const message = dictionary[key] ?? base[key];
    if (message === undefined) return key;
    if (typeof message === 'string') return message;
    const count = vars.count;
    const form = typeof count === 'number' ? plural.select(count) : 'other';
    return message[form] ?? message.other;
  };
  const parts = <T>(key: K, vars: Readonly<Record<string, string | number | T>>) => {
    const out: (string | T)[] = [];
    const source = template(key, vars);
    let last = 0;
    for (const match of source.matchAll(PLACEHOLDER)) {
      const name = match[1] ?? '';
      if (!(name in vars)) continue;
      out.push(source.slice(last, match.index));
      const value = vars[name];
      out.push(typeof value === 'number' ? String(value) : (value as string | T));
      last = match.index + match[0].length;
    }
    out.push(source.slice(last));
    return out.filter((p) => p !== '');
  };
  return {
    lang,
    t: (key, vars = {}) => parts<string>(key, vars).join(''),
    parts,
  };
}

/**
 * The best language we have for the one asked for: "pt-BR" takes "pt-BR", then
 * "pt", then any "pt-*"; otherwise `fallback`.
 */
export function pickLanguage(
  requested: string,
  available: readonly string[],
  fallback = 'en',
): string {
  const lower = available.map((a) => a.toLowerCase());
  const want = requested.toLowerCase();
  const base = want.split('-')[0] ?? want;
  const index = [
    lower.indexOf(want),
    lower.indexOf(base),
    lower.findIndex((a) => a.split('-')[0] === base),
  ].find((i) => i >= 0);
  return index === undefined ? fallback : (available[index] ?? fallback);
}

/** The `{name}` placeholders of a message, every plural form together, sorted. */
export function placeholdersOf(message: Message): string[] {
  const texts = typeof message === 'string' ? [message] : Object.values(message);
  const names = new Set<string>();
  for (const text of texts) for (const m of text.matchAll(PLACEHOLDER)) names.add(m[1] ?? '');
  return [...names].sort();
}
