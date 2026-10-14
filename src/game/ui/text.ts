/**
 * How components get their strings: `const t = useText()`, then `t.t('cashOut')`.
 * The strings themselves are in `src/locales/*.json`; main.ts loads the player's
 * language before the interface renders and provides it here.
 */
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { englishText, type Text } from '../../locales';

export const TextContext = createContext<Text>(englishText());

export function useText(): Text {
  return useContext(TextContext);
}
