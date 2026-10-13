/**
 * Vitest configuration.
 *
 * Two settings here exist because of the development sandbox, not because of
 * test semantics — and both are harmless in CI:
 *
 * 1. `pool: 'threads'` — the default 'forks' pool spawns child processes with
 *    piped stdio, which the sandbox denies (`spawn EPERM`). Threads give the
 *    same per-file isolation without pipes.
 *
 * 2. `resolve.preserveSymlinks: true` — Vite's Windows module resolver shells
 *    out to PowerShell (`optimizeSafeRealPathSync`) to work out 8.3/subst
 *    paths. That exec is denied here and surfaces as an unhandled error while
 *    resolving every file. With this flag Vite uses `fs.realpathSync` instead,
 *    which is also the correct behaviour for a workspace whose packages are
 *    linked by symlink.
 *
 * This file is `.mjs` (not `.ts`) so that no esbuild bundling is needed to read
 * it: Vite bundles a TypeScript config with esbuild's service process, which
 * the sandbox also denies.
 *
 * @type {import('vitest/config').UserConfig}
 */
export default {
  resolve: {
    preserveSymlinks: true,
  },
  test: {
    // Test files use the Vitest globals surface (`describe`/`it`/`expect`),
    // which is also what `tsconfig.base.json` types via `vitest/globals`.
    globals: true,
    pool: 'threads',
    include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'spikes/**', 'docs/**'],
    testTimeout: 30_000,
  },
};
