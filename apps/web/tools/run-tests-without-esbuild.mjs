/* global process, URL */
/**
 * Sandbox-only test runner — NOT the normal path.
 *
 * WHY THIS EXISTS
 * `npm test` (what a developer and CI run) makes Vite bundle `vitest.config.ts`
 * with **esbuild**, and esbuild's JS API always starts a *service child process*
 * over piped stdio. The DSH sandbox rejects that with `spawn EPERM`
 * (see AGENTS.md, «قيود البيئة»), so Vitest and Vite cannot start at all here.
 *
 * WHAT IT DOES INSTEAD — no shims, no monkey-patching of dependencies:
 *   1. `tsc` (pure JavaScript, in-process) compiles `src` + `test` to plain ESM
 *      under `dist/tests-build/` — an output directory that the repository
 *      already ignores for eslint, prettier and git — and copies the one CSS
 *      folder next to it;
 *   2. Vitest is started programmatically with `config: false`, so Vite never
 *      bundles a config file, and with `esbuild: false`, so the already-compiled
 *      JavaScript needs no transform plugin at all;
 *   3. `resolve.preserveSymlinks` keeps Vite away from its Windows `net use`
 *      probe, which also needs a piped child process.
 *
 * The same test files, runner, reporters and assertions run; only the transform
 * chain differs. Nothing here is wired into an npm script, and CI never sees it.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startVitest } from 'vitest/node';

const root = fileURLToPath(new URL('..', import.meta.url));
const buildDir = path.join(root, 'dist', 'tests-build');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const relativeBuildDir = path.relative(root, buildDir).split(path.sep).join('/');

if (!existsSync(tsc)) {
  throw new Error(`typescript is not installed at ${tsc}; run npm install first`);
}

rmSync(buildDir, { recursive: true, force: true });

// `stdio: 'inherit'` matters: the sandbox denies *piped* stdio, not every child.
execFileSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.tests-build.json')], {
  cwd: root,
  stdio: 'inherit',
});

// tsc does not emit CSS, and the app imports one stylesheet.
cpSync(path.join(root, 'src', 'styles'), path.join(buildDir, 'src', 'styles'), {
  recursive: true,
});

const testOptions = {
  pool: 'threads',
  environment: 'jsdom',
  globals: false,
  include: [`${relativeBuildDir}/test/**/*.test.js`],
  // Vitest excludes `**/dist/**` by default, and the compiled suite lives there.
  exclude: ['**/node_modules/**'],
  css: false,
  watch: false,
  run: true,
  testTimeout: 20_000,
};

const vitest = await startVitest(
  'test',
  [],
  {
    config: false,
    root,
    ...testOptions,
    test: testOptions,
  },
  {
    root,
    esbuild: false,
    resolve: { preserveSymlinks: true },
  },
);

const files = vitest?.state.getFiles() ?? [];
const failed = files.filter((file) => file.result?.state === 'fail').length;

await vitest?.close();

process.exitCode = failed > 0 || files.length === 0 ? 1 : 0;
