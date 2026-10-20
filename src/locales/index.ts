/**
 * The game's dictionaries. English is bundled with the game: it is the base every
 * other language falls back to, and the text of a loading error. Every other
 * language is its own small chunk, fetched only by players who need it.
 *
 * Adding a language is adding `xx.json` next to `en.json`; the locale test checks
 * that it has every key and the same placeholders.
 */
import { createTranslator, pickLanguage, type Dictionary, type Translator } from '../shell/i18n';
import en from './en.json';

export type TextKey = keyof typeof en;
export type Text = Translator<TextKey>;

const base: Readonly<Record<TextKey, Dictionary[string]>> = en;

const others = import.meta.glob<Dictionary>(['./*.json', '!./en.json'], { import: 'default' });

export const LANGUAGES: readonly string[] = [
  'en',
  ...Object.keys(others).map((path) => path.slice(2, -'.json'.length)),
];

export function englishText(): Text {
  return createTranslator<TextKey>('en', {}, base);
}

/**
 * The text for the language the operator asked for, or English if we do not have
 * it or it fails to arrive (offline, or a chunk gone after a redeploy).
 */
export async function loadText(requested: string): Promise<Text> {
  const lang = pickLanguage(requested, LANGUAGES);
  const load = others[`./${lang}.json`];
  if (!load) return englishText();
  try {
    return createTranslator<TextKey>(lang, await load(), base);
  } catch (err) {
    console.warn(`The game falls back to English: ${lang} did not load`, err);
    return englishText();
  }
}
