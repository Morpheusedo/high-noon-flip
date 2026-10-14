import { describe, expect, it } from 'vitest';
import { createTranslator, pickLanguage, placeholdersOf } from '../src/shell/i18n';
import en from '../src/locales/en.json';
import { LANGUAGES, loadText, type TextKey } from '../src/locales';

const base = {
  hello: 'Hello, {name}!',
  picks: { one: '{count} pick', other: '{count} picks' },
  only: 'English only',
};

describe('translator', () => {
  it('fills placeholders and leaves unknown ones as they are', () => {
    const { t } = createTranslator('en', {}, base);
    expect(t('hello', { name: 'Ann' })).toBe('Hello, Ann!');
    expect(t('hello')).toBe('Hello, {name}!');
  });

  it('picks the plural form the language needs', () => {
    const ru = createTranslator(
      'ru',
      {
        picks: {
          one: '{count} бросок',
          few: '{count} броска',
          many: '{count} бросков',
          other: '{count} броска',
        },
      },
      base,
    );
    expect([1, 3, 8, 21].map((count) => ru.t('picks', { count }))).toEqual([
      '1 бросок',
      '3 броска',
      '8 бросков',
      '21 бросок',
    ]);
    expect(createTranslator('en', {}, base).t('picks', { count: 8 })).toBe('8 picks');
  });

  it('falls back to the base dictionary for a missing key', () => {
    expect(createTranslator('ru', {}, base).t('only')).toBe('English only');
  });

  it('splits around placeholders so a view can put elements in them', () => {
    const bold = { tag: 'b' };
    const { parts } = createTranslator('en', {}, base);
    expect(parts('hello', { name: bold })).toEqual(['Hello, ', bold, '!']);
  });
});

describe('pickLanguage', () => {
  const have = ['en', 'ru', 'pt-BR'];
  it.each([
    ['ru', 'ru'],
    ['ru-RU', 'ru'],
    ['pt-br', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['de', 'en'],
  ])('%s → %s', (asked, got) => expect(pickLanguage(asked, have)).toBe(got));
});

describe('locales', () => {
  it('every language has every English key, with the same placeholders', async () => {
    const keys = Object.keys(en) as TextKey[];
    for (const lang of LANGUAGES.filter((l) => l !== 'en')) {
      const dictionary = (await import(`../src/locales/${lang}.json`)) as {
        default: Record<string, Parameters<typeof placeholdersOf>[0]>;
      };
      const other = dictionary.default;
      expect(Object.keys(other).sort(), lang).toEqual([...keys].sort());
      for (const key of keys) {
        const theirs = other[key];
        expect(theirs, `${lang}: ${key}`).toBeDefined();
        if (theirs)
          expect(placeholdersOf(theirs), `${lang}: ${key}`).toEqual(placeholdersOf(en[key]));
      }
    }
  });

  it('a plural message in each language has the forms that language uses', async () => {
    for (const lang of LANGUAGES) {
      const { default: dict } = (await import(`../src/locales/${lang}.json`)) as {
        default: Record<string, unknown>;
      };
      const needed = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
      for (const [key, message] of Object.entries(dict)) {
        if (typeof message === 'string') continue;
        for (const form of needed) expect(message, `${lang}: ${key}.${form}`).toHaveProperty(form);
      }
    }
  });

  it('loads the language asked for, and English for one we do not have', async () => {
    expect((await loadText('ru-RU')).lang).toBe('ru');
    expect((await loadText('ru')).t('cashOut')).toBe('Забрать');
    expect((await loadText('xx')).lang).toBe('en');
  });
});
