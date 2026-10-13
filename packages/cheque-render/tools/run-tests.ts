/**
 * Local test runner.
 *
 * The repository's real test command is Vitest (`vitest.config.mjs`,
 * `pool: 'threads'`). Vitest cannot start inside this development sandbox: Vite
 * bundles its config with esbuild, and esbuild starts a service process with
 * piped stdio, which the sandbox denies (`spawn EPERM`). That is a documented
 * limitation of this machine (see the repository AGENTS.md), not a property of
 * the tests.
 *
 * So that the same test files can still be executed here, this runner provides
 * the small `globals: true` Vitest surface the tests use (`describe`, `it`,
 * `expect`, lifecycle hooks, `expect.assertions`) and prints a plain summary.
 * The test files import nothing from Vitest, so `vitest run` and this runner
 * execute byte-for-byte the same assertions.
 *
 * Usage: `node tools/run-tests.ts`
 */
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type TestFn = () => void | Promise<void>;

interface TestCase {
  readonly name: string;
  readonly fn: TestFn;
}

interface Suite {
  readonly name: string;
  readonly beforeAll: TestFn[];
  readonly afterAll: TestFn[];
  readonly beforeEach: TestFn[];
  readonly afterEach: TestFn[];
  readonly tests: TestCase[];
}

const suiteStack: Suite[] = [];
const registeredSuites: Suite[] = [];

function currentSuite(): Suite {
  const suite = suiteStack[suiteStack.length - 1];
  if (!suite) throw new Error('describe/it used outside of a suite');
  return suite;
}

interface AssertionState {
  expectedAssertionCount: number | undefined;
  assertionCount: number;
}

const state: AssertionState = { expectedAssertionCount: undefined, assertionCount: 0 };

function inspect(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

class Expectation {
  private readonly actual: unknown;
  private readonly isNegated: boolean;

  constructor(actual: unknown, isNegated = false) {
    this.actual = actual;
    this.isNegated = isNegated;
  }

  get not(): Expectation {
    return new Expectation(this.actual, !this.isNegated);
  }

  private check(pass: boolean, message: string): void {
    state.assertionCount += 1;
    if (pass === this.isNegated) {
      throw new AssertionError(this.isNegated ? `expected NOT: ${message}` : message);
    }
  }

  toBe(expected: unknown): void {
    this.check(
      Object.is(this.actual, expected),
      `expected ${inspect(this.actual)} to be ${inspect(expected)}`,
    );
  }

  toEqual(expected: unknown): void {
    this.check(
      JSON.stringify(this.actual) === JSON.stringify(expected),
      `expected ${inspect(this.actual)} to equal ${inspect(expected)}`,
    );
  }

  toBeCloseTo(expected: number, digits = 2): void {
    const actual = this.actual as number;
    const tolerance = 0.5 * 10 ** -digits;
    this.check(
      Number.isFinite(actual) && Math.abs(actual - expected) < tolerance,
      `expected ${inspect(actual)} to be close to ${expected} (tolerance ${tolerance})`,
    );
  }

  toBeLessThan(expected: number): void {
    this.check(
      (this.actual as number) < expected,
      `expected ${inspect(this.actual)} to be < ${expected}`,
    );
  }

  toBeLessThanOrEqual(expected: number): void {
    this.check(
      (this.actual as number) <= expected,
      `expected ${inspect(this.actual)} to be <= ${expected}`,
    );
  }

  toBeGreaterThan(expected: number): void {
    this.check(
      (this.actual as number) > expected,
      `expected ${inspect(this.actual)} to be > ${expected}`,
    );
  }

  toBeGreaterThanOrEqual(expected: number): void {
    this.check(
      (this.actual as number) >= expected,
      `expected ${inspect(this.actual)} to be >= ${expected}`,
    );
  }

  toBeDefined(): void {
    this.check(this.actual !== undefined, `expected ${inspect(this.actual)} to be defined`);
  }

  toBeUndefined(): void {
    this.check(this.actual === undefined, `expected ${inspect(this.actual)} to be undefined`);
  }

  toBeTruthy(): void {
    this.check(Boolean(this.actual), `expected ${inspect(this.actual)} to be truthy`);
  }

  toBeFalsy(): void {
    this.check(!this.actual, `expected ${inspect(this.actual)} to be falsy`);
  }

  toMatch(pattern: RegExp | string): void {
    const actual = String(this.actual);
    const pass = pattern instanceof RegExp ? pattern.test(actual) : actual.includes(pattern);
    this.check(pass, `expected ${inspect(actual)} to match ${String(pattern)}`);
  }

  toContain(expected: unknown): void {
    const actual = this.actual;
    const pass = Array.isArray(actual)
      ? actual.some((entry) => JSON.stringify(entry) === JSON.stringify(expected))
      : String(actual).includes(String(expected));
    this.check(pass, `expected ${inspect(actual)} to contain ${inspect(expected)}`);
  }

  toHaveLength(expected: number): void {
    const actual = this.actual as { length?: number };
    this.check(
      actual?.length === expected,
      `expected length ${String(actual?.length)} to be ${expected}`,
    );
  }

  toBeInstanceOf(expected: new (...args: never[]) => unknown): void {
    this.check(
      this.actual instanceof expected,
      `expected ${inspect(this.actual)} to be an instance of ${expected.name}`,
    );
  }

  toThrow(expected?: string | RegExp | (new (...args: never[]) => unknown)): void {
    if (typeof this.actual !== 'function') {
      this.check(false, 'toThrow expects a function');
      return;
    }
    let thrown: unknown;
    try {
      (this.actual as () => unknown)();
    } catch (error) {
      thrown = error;
    }
    if (expected === undefined) {
      this.check(thrown !== undefined, 'expected the function to throw');
      return;
    }
    if (typeof expected === 'function') {
      this.check(thrown instanceof expected, `expected the function to throw ${expected.name}`);
      return;
    }
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    const pass = expected instanceof RegExp ? expected.test(message) : message.includes(expected);
    this.check(
      pass,
      `expected the thrown message ${inspect(message)} to match ${String(expected)}`,
    );
  }
}

interface ExpectFn {
  (actual: unknown): Expectation;
  assertions(count: number): void;
}

const expect = ((actual: unknown) => new Expectation(actual)) as ExpectFn;
expect.assertions = (count: number): void => {
  state.expectedAssertionCount = count;
};

const globalsRecord = globalThis as unknown as Record<string, unknown>;
globalsRecord.describe = (name: string, body: () => void): void => {
  const suite: Suite = {
    name,
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
    tests: [],
  };
  suiteStack.push(suite);
  try {
    body();
  } finally {
    suiteStack.pop();
  }
  registeredSuites.push(suite);
};
globalsRecord.it = (name: string, fn: TestFn): void => {
  currentSuite().tests.push({ name, fn });
};
globalsRecord.test = globalsRecord.it;
globalsRecord.expect = expect;

// `describe` keeps the suite on the stack for its whole body, so the lifecycle
// hooks simply append to the suite currently being declared.
globalsRecord.beforeAll = (fn: TestFn): void => {
  currentSuite().beforeAll.push(fn);
};
globalsRecord.afterAll = (fn: TestFn): void => {
  currentSuite().afterAll.push(fn);
};
globalsRecord.beforeEach = (fn: TestFn): void => {
  currentSuite().beforeEach.push(fn);
};
globalsRecord.afterEach = (fn: TestFn): void => {
  currentSuite().afterEach.push(fn);
};

function collectTestFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      const full = join(directory, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.test.ts')) found.push(full);
    }
  };
  walk(root);
  return found.sort();
}

async function main(): Promise<void> {
  const packageRoot = resolve(import.meta.dirname, '..');
  const files = collectTestFiles(join(packageRoot, 'test'));
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const file of files) {
    const relative = file.slice(packageRoot.length + 1);
    console.log(`\n== ${relative}`);
    await import(pathToFileURL(file).href);
  }

  for (const suite of registeredSuites) {
    console.log(`\n# ${suite.name}`);
    for (const hook of suite.beforeAll) await hook();
    for (const testCase of suite.tests) {
      for (const hook of suite.beforeEach) await hook();
      state.assertionCount = 0;
      state.expectedAssertionCount = undefined;
      try {
        await testCase.fn();
        if (
          state.expectedAssertionCount !== undefined &&
          state.assertionCount !== state.expectedAssertionCount
        ) {
          throw new AssertionError(
            `expected ${state.expectedAssertionCount} assertions, received ${state.assertionCount}`,
          );
        }
        passed += 1;
        console.log(`  ok   ${testCase.name}`);
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        console.log(`  FAIL ${testCase.name}`);
        console.log(`       ${message}`);
        failures.push(`${suite.name} > ${testCase.name}\n       ${message}`);
      } finally {
        for (const hook of suite.afterEach) await hook();
      }
    }
    for (const hook of suite.afterAll) await hook();
  }

  console.log(`\n${passed} passed, ${failed} failed (${files.length} test file(s))`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`- ${failure}`);
    process.exitCode = 1;
  }
}

await main();
