// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Layer boundaries are the project rule (CONVENTIONS.md 7): dependencies flow
 * downward only, and a module is reached through its public `index.ts`.
 * `eslint-plugin-boundaries` is added separately once it is adopted; until then
 * this config enforces types and the shared style rules.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '_intake/**',
      '_scratch/**',
      'spikes/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Tools and scripts are allowed to print.
    files: ['**/tools/**/*.ts', '**/*.config.{ts,mjs,js}'],
    rules: { 'no-console': 'off' },
  },
);
