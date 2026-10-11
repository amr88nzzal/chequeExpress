import { describe, expect, it } from 'vitest';
import { failure, success } from './envelope.ts';

describe('envelope', () => {
  it('wraps data with the request id', () => {
    expect(success({ a: 1 }, 'r1')).toEqual({ ok: true, data: { a: 1 }, requestId: 'r1' });
  });
  it('wraps errors with a stable code', () => {
    expect(failure('NOT_FOUND', 'x', 'r2').error.code).toBe('NOT_FOUND');
  });
});
