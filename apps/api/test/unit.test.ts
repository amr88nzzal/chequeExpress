/**
 * Unit tests: no database, no HTTP, no clock. These always run, on any machine.
 */
import { describe, expect, it } from 'vitest';
import { isUuidV7, uuidv7 } from '../src/http/ids.ts';
import { formatDecimalAmount } from '../src/demo/demo-items.service.ts';
import { decimalAmountSchema } from '../src/demo/demo-items.service.ts';

describe('uuidv7', () => {
  it('produces an RFC 9562 version-7 uuid', () => {
    const id = uuidv7(1_700_000_000_000);
    expect(isUuidV7(id)).toBe(true);
    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('is unique and ordered within the same millisecond', () => {
    const ids = Array.from({ length: 50 }, () => uuidv7(1_700_000_000_000));
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });

  it('keeps order and uniqueness well past a single counter byte', () => {
    // Regression: the counter once lived in the high nibble of byte 6, where the
    // version field is, so it truncated to 4 bits and wrapped after 16 ids.
    const ids = Array.from({ length: 5_000 }, () => uuidv7(1_700_000_000_000));
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    expect(isUuidV7(ids[0] as string)).toBe(true);
  });

  it('stays monotonic when the wall clock does not move (deterministic clock)', () => {
    // 5,000 ids requested at the same instant: past 4,096 the generator borrows
    // from the next millisecond instead of wrapping its counter.
    const ids = Array.from({ length: 5_000 }, () => uuidv7(1_700_000_000_000));
    expect([...ids].sort()).toEqual(ids);
  });

  it('stays monotonic and unique against the real wall clock', () => {
    const ids = Array.from({ length: 2_000 }, () => uuidv7());
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });

  it('orders ids by timestamp across milliseconds', () => {
    const earlier = uuidv7(1_700_000_000_000);
    const later = uuidv7(1_700_000_001_000);
    expect(earlier < later).toBe(true);
  });

  it('keeps the encoded timestamp at or after the requested one, in a valid v7 id', () => {
    // This is the contract that matters and it holds regardless of the module's
    // monotonic state. Exact-prefix assertions were removed deliberately: the
    // generator keeps a last-seen millisecond so ids stay increasing, and it
    // bumps an explicit timestamp older than the last one issued (see the
    // comment in src/http/ids.ts). Vitest shares module state within a file, so
    // an exact-prefix assertion would depend on test order. `isUuidV7` already
    // validates the version and variant nibbles and the canonical layout.
    for (const milliseconds of [1_713_000_000_000, 0, 7_258_118_400_000]) {
      const id = uuidv7(milliseconds);
      expect(isUuidV7(id)).toBe(true);
      const encoded = Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
      // The generator never yields a timestamp earlier than the one requested:
      // it either honours it or moves it forward to preserve monotonicity.
      expect(encoded).toBeGreaterThanOrEqual(milliseconds);
    }
  });
});

describe('decimal amount handling', () => {
  it('pads to the 4 fraction digits of numeric(18,4) without rounding', () => {
    expect(formatDecimalAmount('3355.515')).toBe('3355.5150');
    expect(formatDecimalAmount('3355.5150')).toBe('3355.5150');
    expect(formatDecimalAmount('515')).toBe('515.0000');
    expect(formatDecimalAmount('0.5')).toBe('0.5000');
  });

  it('never turns a decimal string into a float', () => {
    // 514.99999999987267 would print as 514.9999999998727 if it went through a number.
    expect(formatDecimalAmount('514.9999')).toBe('514.9999');
    expect(typeof formatDecimalAmount('514.9999')).toBe('string');
  });

  it('REJECTS a JSON number, which is the whole point of the money rule', () => {
    const result = decimalAmountSchema.safeParse(3355.515);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('decimal string');
    }
  });

  it('rejects more fraction digits than the column can hold', () => {
    expect(decimalAmountSchema.safeParse('1.23456').success).toBe(false);
  });

  it('rejects scientific notation and signs', () => {
    expect(decimalAmountSchema.safeParse('1e3').success).toBe(false);
    expect(decimalAmountSchema.safeParse('-5.0000').success).toBe(false);
    expect(decimalAmountSchema.safeParse('').success).toBe(false);
  });

  it('accepts a plain decimal string', () => {
    expect(decimalAmountSchema.safeParse('3355.5150').success).toBe(true);
  });
});
