import { defineConfig } from 'vitest/config';

/**
 * `pool: 'threads'` is required on this project's developer machines: the DSH
 * sandbox denies child processes with piped stdio, and the default 'forks' pool
 * spawns exactly that. Threads keep the same test isolation without pipes.
 */
export default defineConfig({
  test: {
    pool: 'threads',
    include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'spikes/**', '_intake/**', 'spikes/**'],
    reporters: ['default'],
    testTimeout: 30_000,
  },
});
