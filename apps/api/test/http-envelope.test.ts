/**
 * HTTP contract tests: the success envelope, the error envelope, the requestId
 * middleware and the identity boundary.
 *
 * These need NO database. `throwingDb` fails the test if any of them executes a
 * query, which is also an assertion in its own right.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, identityHeaders, TEST_REQUEST_TIME } from './support/test-app.ts';
import { TENANT_A } from '../src/db/seed.ts';

const USER_ID = '01890000-0000-7000-8000-0000000000aa';
const { app } = buildTestApp();

describe('GET /health', () => {
  it('answers 200 with the standard success envelope and the injected clock', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({
      data: {
        status: 'ok',
        service: 'cheques-api',
        version: '0.0.1-test',
        time: TEST_REQUEST_TIME,
        uptimeSeconds: expect.any(Number),
      },
      meta: { requestId: expect.any(String) },
    });
    expect(response.headers['x-request-id']).toBe(response.body.meta.requestId);
  });

  it('does not require identity: a monitor has no tenant', async () => {
    await request(app).get('/health').expect(200);
  });

  it('reuses a safe inbound request id and rejects an unsafe one', async () => {
    const reused = await request(app).get('/health').set('x-request-id', 'trace-123').expect(200);
    expect(reused.body.meta.requestId).toBe('trace-123');

    const replaced = await request(app)
      .get('/health')
      .set('x-request-id', 'bad id with spaces')
      .expect(200);
    expect(replaced.body.meta.requestId).not.toBe('bad id with spaces');
  });
});

describe('error envelope', () => {
  it('answers an unknown route with 404 and the standard error body', async () => {
    const response = await request(app).get('/nope').expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'No route matches GET /nope',
        requestId: expect.any(String),
      },
    });
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
    expect(response.body.error.details).toBeUndefined();
    expect(response.body.data).toBeUndefined();
  });

  it('answers a missing identity header with 401', async () => {
    const response = await request(app).get('/api/v1/demo-items').expect(401);

    expect(response.body.error).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Missing identity header: x-tenant-id',
    });
  });

  it('answers a malformed identity header with 401, not 500', async () => {
    const response = await request(app)
      .get('/api/v1/demo-items')
      .set('x-tenant-id', 'not-a-uuid')
      .set('x-user-id', USER_ID)
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('answers a validation failure with 400 and the field paths in details', async () => {
    const response = await request(app)
      .post('/api/v1/demo-items')
      .set(identityHeaders(TENANT_A.tenantId, USER_ID))
      .send({ label: '', amount: 3355.515, currency: 'jd' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.message).toBe('Request validation failed');
    expect(response.body.error.details.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'label' }),
        expect.objectContaining({ path: 'amount' }),
        expect.objectContaining({ path: 'currency' }),
      ]),
    );
  });

  it('answers a non-uuid path parameter with 400', async () => {
    const response = await request(app)
      .get('/api/v1/demo-items/12')
      .set(identityHeaders(TENANT_A.tenantId, USER_ID))
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.issues[0].path).toBe('(root)');
  });
});
