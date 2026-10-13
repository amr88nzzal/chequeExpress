/**
 * Console output for the CLI entry points.
 *
 * `no-console` is a warning in this repository's ESLint config, and a warning still
 * pollutes the output of `eslint apps/api`. Rather than adding an inline disable to
 * every call site, the two CLI scripts route their progress output through this
 * module: it is the single, intended place where a command-line tool writes to
 * stdout, and it is documented as such.
 *
 * The API itself never writes to stdout — it logs with pino (src/http/logger.ts).
 */

export function writeOut(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
}
