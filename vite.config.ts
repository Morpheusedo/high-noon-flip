import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Relative base: the provider hosts the build under its own CDN path,
  // e.g. https://cdn.provider.com/high-noon-flip/0.1.0/
  base: './',
  plugins: [preact()],
  server: { port: 5173 },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'] },
});
