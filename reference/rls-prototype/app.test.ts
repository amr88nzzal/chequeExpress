import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';

let server: Server;
let ready = true;
let base = '';

beforeAll(async () => {
  const app = createApp({
    readiness: async () => {
      if (!ready) throw new Error('down');
    },
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('health', () => {
  it('live returns the envelope and a request id', async () => {
    const res = await fetch(`${base}/health/live`);
    const body = (await res.json()) as { ok: boolean; requestId: string };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('ready is 200 when dependencies are up and 503 when not', async () => {
    expect((await fetch(`${base}/health/ready`)).status).toBe(200);
    ready = false;
    const res = await fetch(`${base}/health/ready`);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_READY');
    ready = true;
  });

  it('echoes a supplied request id', async () => {
    const res = await fetch(`${base}/health/live`, { headers: { 'x-request-id': 'abc' } });
    expect(((await res.json()) as { requestId: string }).requestId).toBe('abc');
  });

  it('unknown routes return NOT_FOUND in the envelope', async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });
});
