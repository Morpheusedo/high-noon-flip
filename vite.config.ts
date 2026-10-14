import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import pkg from './package.json' with { type: 'json' };
import { buildHash } from './scripts/buildInfo.ts';

export default defineConfig({
  // Relative base: the provider hosts the build under its own CDN path,
  // e.g. https://cdn.provider.com/high-noon-flip/0.1.0/
  base: './',
  plugins: [preact()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_HASH__: JSON.stringify(buildHash(import.meta.dirname)),
  },
  server: { port: 5173 },
  // `npm run smoke` tests the build here; the dev server keeps 5173
  preview: { port: 4173, strictPort: true },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'] },
});
