import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

/**
 * `pool: 'threads'` is mandatory on this project's developer machines: the DSH
 * sandbox denies child processes with piped stdio and the default `forks` pool
 * spawns exactly that (see AGENTS.md, "قيود البيئة").
 *
 * The test files themselves do not depend on this config: each one declares
 * `// @vitest-environment jsdom`, so the suite also runs under the repository
 * root config (`npx vitest run apps/web`).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    pool: 'threads',
    environment: 'jsdom',
    globals: false,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    css: false,
    restoreMocks: true,
    testTimeout: 20_000,
  },
});
