import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'prototype', 'coverage', 'test-results', 'playwright-report', '.netlify'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  prettier,
  {
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // build scripts and test tools run in Node and report to the terminal
    files: ['scripts/**', 'e2e/**', 'tests/node/**', '*.config.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
);
