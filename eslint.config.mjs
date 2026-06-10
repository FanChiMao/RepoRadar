// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    // Build output, deps, Python backend and packaged artifacts are not linted.
    ignores: ['dist/**', 'node_modules/**', 'backend/**', 'release/**', 'assets/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Electron main / preload run in Node.
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Renderer scripts run in the browser.
    files: ['frontend/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    rules: {
      // The codebase intentionally uses `any` at the dynamic API boundary; keep
      // it visible as a warning rather than a hard error.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow intentionally-unused args/vars when prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
);
