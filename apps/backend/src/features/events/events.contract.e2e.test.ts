import { randomBytes } from 'node:crypto';

import {
  EventAcceptedSchema,
  SubscriberWithChannelsSchema,
  TemplateVersionSchema,
  WorkspaceWithCredentialSchema,
  dataEnvelope,
} from '@communique/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.DATABASE_URL ??= 'postgres://placeholder:placeholder@localhost:5999/placeholder';
process.env.REDIS_URL ??= 'redis://localhost:6999';
process.env.PROVIDER_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');

import { startStack, stopStack, truncateAll, type TestStack } from '../../test/containers.js';

let stack: TestStack;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

beforeAll(async () => {
  stack = await startStack();
  const { buildApp } = await import('../../app.js');
  app = buildApp();
});

afterAll(async () => {
  const { closePool } = await import('../../lib/db.js');
  const { closeRedis } = await import('../../lib/redis.js');
  await closePool();
  await closeRedis();
  await stopStack(stack);
});

beforeEach(async () => {
  await truncateAll();
});

let wsCounter = 0;
async function bootstrap(): Promise<string> {
  wsCounter += 1;
  const res = await request(app)
    .post('/api/v1/workspaces')
    .send({ name: `Contract Co ${wsCounter}` });
  expect(res.status).toBe(201);
  expect(() => WorkspaceWithCredentialSchema.parse(res.body.data)).not.toThrow();
  return res.body.data.credential.key as string;
}

describe('contract: responses match @communique/core Zod schemas', () => {
  it('full happy-path flow returns schema-valid envelopes end-to-end', async () => {
    const key = await bootstrap();
    const auth = { Authorization: `Bearer ${key}` };

    // register subscriber
    const sub = await request(app)
      .post('/api/v1/subscribers')
      .set(auth)
      .send({
        external_id: 'u1',
        channels: [{ channel: 'email', address: 'u1@example.com' }],
      });
    expect(sub.status).toBe(201);
    expect(() => SubscriberWithChannelsSchema.parse(sub.body.data)).not.toThrow();

    // template + version
    const tpl = await request(app)
      .post('/api/v1/templates')
      .set(auth)
      .send({ name: 'Welcome', event_type: 'user.welcome', channel: 'email' });
    const ver = await request(app)
      .post(`/api/v1/templates/${tpl.body.data.id}/versions`)
      .set(auth)
      .send({ subject: 'Hi {{name}}', body_text: 'Hello {{name}}', required_vars: ['name'] });
    expect(ver.status).toBe(201);
    expect(() => TemplateVersionSchema.parse(ver.body.data)).not.toThrow();

    // provider + audience + rule
    await request(app).post('/api/v1/providers').set(auth).send({
      channel: 'email',
      provider_key: 'console',
      config: {},
    });
    const aud = await request(app).post('/api/v1/audiences').set(auth).send({ name: 'All' });
    await request(app)
      .post(`/api/v1/audiences/${aud.body.data.id}/members`)
      .set(auth)
      .send({ subscriber_id: sub.body.data.id });
    await request(app).post('/api/v1/routing-rules').set(auth).send({
      event_type: 'user.welcome',
      channel: 'email',
      template_id: tpl.body.data.id,
      audience_id: aud.body.data.id,
    });

    // publish event → 202 + EventAccepted shape
    const evt = await request(app)
      .post('/api/v1/events')
      .set(auth)
      .send({ event_type: 'user.welcome', audience_id: aud.body.data.id, payload: { name: 'Ada' } });
    expect(evt.status).toBe(202);
    expect(() => dataEnvelope(EventAcceptedSchema).parse(evt.body)).not.toThrow();
  });

  it('validation error is flat with one field (errorCode 1001)', async () => {
    const key = await bootstrap();
    const res = await request(app)
      .post('/api/v1/subscribers')
      .set('Authorization', `Bearer ${key}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      errorCode: 1001,
      type: 'validation_error',
      field: 'external_id',
    });
    expect(res.body.error).toBeUndefined(); // FLAT, no nested error object
  });

  it('rejects unauthenticated requests with flat 1002', async () => {
    const res = await request(app).get('/api/v1/subscribers');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ errorCode: 1002, type: 'auth_error' });
  });

  it('isolates workspaces (cross-workspace read → 404)', async () => {
    const keyA = await bootstrap();
    const subA = await request(app)
      .post('/api/v1/subscribers')
      .set('Authorization', `Bearer ${keyA}`)
      .send({ external_id: 'a-only' });

    const keyB = await bootstrap();
    const res = await request(app)
      .get(`/api/v1/subscribers/${subA.body.data.id}`)
      .set('Authorization', `Bearer ${keyB}`);
    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe(1004);
  });
});
