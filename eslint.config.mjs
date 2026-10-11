import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'inputs/**',
      'spikes/**',
      'reference/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Money must never be a JS float; amounts are decimal strings (see docs/CONVENTIONS.md section 6).
      'no-restricted-globals': [
        'error',
        { name: 'parseFloat', message: 'Never parse money as float.' },
      ],
    },
  },
  {
    // Layer rules: dependencies go downward only, through each module's index.ts (CONVENTIONS section 7).
    files: ['apps/api/src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        {
          type: 'foundation',
          pattern: 'apps/api/src/modules/{system,identity,org}/**',
          mode: 'full',
        },
        { type: 'master', pattern: 'apps/api/src/modules/{parties,books}/**', mode: 'full' },
        { type: 'cheques', pattern: 'apps/api/src/modules/{issued,received}/**', mode: 'full' },
        {
          type: 'features',
          pattern: 'apps/api/src/modules/{printing,agents,forecast,imports,reports}/**',
          mode: 'full',
        },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'foundation', allow: ['foundation'] },
            { from: 'master', allow: ['foundation', 'master'] },
            { from: 'cheques', allow: ['foundation', 'master', 'cheques'] },
            { from: 'features', allow: ['foundation', 'master', 'cheques', 'features'] },
          ],
        },
      ],
    },
  },
);
