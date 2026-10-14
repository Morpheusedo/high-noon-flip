/** URL of a file in public/assets, correct both in dev and under the provider's CDN path. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}
