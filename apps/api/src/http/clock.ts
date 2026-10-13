/**
 * The clock is injected via `ctx.clock` so that no business logic calls
 * `new Date()` (docs/CONVENTIONS.md 6), and so that tests are deterministic.
 */

export interface Clock {
  /** Current instant, in UTC. */
  now(): Date;
  /** Current instant as an ISO 8601 string (the API's transport format, §13). */
  nowIso(): string;
}

export function systemClock(): Clock {
  return {
    now: () => new Date(),
    nowIso: () => new Date().toISOString(),
  };
}

/**
 * Deterministic clock for tests and for seeded fixtures. It never advances on its
 * own; a test that needs time to move calls `advance`.
 */
export interface FixedClock extends Clock {
  set(instant: string | Date): void;
  advance(milliseconds: number): void;
}

export function fixedClock(instant: string | Date = '2026-01-01T00:00:00.000Z'): FixedClock {
  let current = instant instanceof Date ? instant : new Date(instant);
  return {
    now: () => new Date(current.getTime()),
    nowIso: () => current.toISOString(),
    set: (next) => {
      current = next instanceof Date ? next : new Date(next);
    },
    advance: (milliseconds) => {
      current = new Date(current.getTime() + milliseconds);
    },
  };
}
