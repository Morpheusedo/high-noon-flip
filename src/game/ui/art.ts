/**
 * Every interface image, for the loading screen to fetch before the interface
 * shows. The stylesheets use the same files, so they find them already loaded.
 */
export const UI_ART: readonly string[] = Object.values(
  import.meta.glob<string>('./art/*.webp', { eager: true, query: '?url', import: 'default' }),
);
