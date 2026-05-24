import { randomBytes } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// env.ts reads these at import — set BEFORE anything imports it.
// A tiny capacity makes the throttle deterministic.
process.env.DATABASE_URL ??= 'postgres://placeholder:placeholder@localhost:5999/placeholder';
process.env.REDIS_URL ??= 'redis://localhost:6999';
process.env.PROVIDER_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');
process.env.RATE_LIMIT_CAPACITY = '3';
process.env.RATE_LIMIT_REFILL_PER_SEC = '0.001'; // effectively no refill during the test

import { startStack, stopStack, truncateAll, type TestStack } from '../test/containers.js';

let stack: TestStack;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let key: string;

beforeAll(async () => {
  stack = await startStack();
  const { buildApp } = await import('../app.js');
  app = buildApp();
});

afterAll(async () => {
  const { closePool } = await import('../lib/db.js');
  const { closeRedis } = await import('../lib/redis.js');
  await closePool();
  await closeRedis();
  await stopStack(stack);
});

beforeEach(async () => {
  await truncateAll();
  const res = await request(app).post('/api/v1/workspaces').send({ name: 'RL Co' });
  key = res.body.data.credential.key;
  // reset the bucket between tests
  const { redis } = await import('../lib/redis.js');
  await redis.flushall();
});

describe('rate limiter (BUG-CRIT-01 regression)', () => {
  it('returns 429/1007 with Retry-After when throttled — and does NOT crash the server', async () => {
    const auth = { Authorization: `Bearer ${key}` };

    // capacity is 3: first 3 succeed, the 4th is throttled.
    const statuses: number[] = [];
    let throttled: request.Response | undefined;
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app).get('/api/v1/subscribers').set(auth);
      statuses.push(res.status);
      if (res.status === 429) throttled = res;
    }

    // We got a throttle, and it's the documented flat envelope — not a crash.
    expect(statuses).toContain(429);
    expect(throttled).toBeDefined();
    expect(throttled!.body).toMatchObject({ errorCode: 1007, type: 'rate_limit_error' });
    expect(throttled!.headers['retry-after']).toBeDefined();

    // The server survived the throttle: a fresh request still gets a response
    // (health is not rate-limited, so it must answer 200).
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
  });
});
