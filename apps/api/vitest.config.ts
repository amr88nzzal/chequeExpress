import { defineConfig } from 'vitest/config';

/**
 * The root `vitest.config.ts` already pins `pool: 'threads'` for this project's
 * developer machines (the DSH sandbox denies piped-stdio child processes, and the
 * default 'forks' pool spawns exactly that). This config keeps the same settings
 * for `vitest run` invoked from inside `apps/api` (plain `npm test` in the
 * workspace) and narrows the include to this app.
 */
export default defineConfig({
  test: {
    pool: 'threads',
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    reporters: ['default'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
