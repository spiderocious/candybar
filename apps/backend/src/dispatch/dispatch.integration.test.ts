import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.DATABASE_URL ??= 'postgres://placeholder:placeholder@localhost:5999/placeholder';
process.env.REDIS_URL ??= 'redis://localhost:6999';
process.env.PROVIDER_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');

import { startStack, stopStack, truncateAll, type TestStack } from '../test/containers.js';

let stack: TestStack;
const WS = 'ws_disp_0001';

async function seedWorkspace(): Promise<void> {
  const { pool } = await import('../lib/db.js');
  await pool.query(`INSERT INTO workspaces (id, name, slug) VALUES ($1, 'Disp', 'disp')`, [WS]);
}

beforeAll(async () => {
  stack = await startStack();
});

afterAll(async () => {
  const { closePool } = await import('../lib/db.js');
  await closePool();
  await stopStack(stack);
});

beforeEach(async () => {
  await truncateAll();
  await seedWorkspace();
});

/** Build a fully-routed event ready to dispatch via the console provider. */
async function seedRoutedEvent(payload: Record<string, unknown>): Promise<string> {
  const { subscribersService } = await import('../features/subscribers/subscribers.service.js');
  const { audiencesService } = await import('../features/audiences/audiences.service.js');
  const { templatesService } = await import('../features/templates/templates.service.js');
  const { providersService } = await import('../features/providers/providers.service.js');
  const { routingRulesService } = await import('../features/routing-rules/routing-rules.service.js');
  const { eventsRepository } = await import('../features/events/events.repository.js');

  const sub = await subscribersService.register(WS, {
    external_id: 'u1',
    channels: [{ channel: 'email', address: 'u1@example.com' }],
  });
  if (!sub.success) throw new Error('sub');

  const aud = await audiencesService.create(WS, { name: 'All' });
  if (!aud.success) throw new Error('aud');
  await audiencesService.addMember(WS, aud.data.id, { subscriber_id: sub.data.id });

  const tpl = await templatesService.create(WS, {
    name: 'Welcome',
    event_type: 'user.welcome',
    channel: 'email',
  });
  if (!tpl.success) throw new Error('tpl');
  await templatesService.publishVersion(WS, tpl.data.id, {
    subject: 'Hi {{name}}',
    body_text: 'Hello {{name}}',
    required_vars: ['name'],
  });

  await providersService.create(WS, { channel: 'email', provider_key: 'console', config: {} });
  await routingRulesService.create(WS, {
    event_type: 'user.welcome',
    channel: 'email',
    template_id: tpl.data.id,
    audience_id: aud.data.id,
  });

  const { event } = await eventsRepository.ingest({
    workspaceId: WS,
    eventType: 'user.welcome',
    payload,
    targetKind: 'audience',
    targetRef: aud.data.id,
    idempotencyKey: null,
  });
  return event.id;
}

describe('dispatch pipeline (real Postgres)', () => {
  it('dispatches a routed event via the console provider and logs success', async () => {
    const { processEvent } = await import('./dispatch.service.js');
    const eventId = await seedRoutedEvent({ name: 'Ada' });

    await processEvent(WS, eventId);

    const { pool } = await import('../lib/db.js');
    const attempts = await pool.query(`SELECT status, provider_key FROM dispatch_attempts`);
    expect(attempts.rows).toHaveLength(1);
    expect(attempts.rows[0]).toMatchObject({ status: 'success', provider_key: 'console' });

    const ev = await pool.query(`SELECT status FROM events WHERE id = $1`, [eventId]);
    expect(ev.rows[0]).toMatchObject({ status: 'dispatched' });
  });

  it('routes an event with a missing required var to dead-letter (not silent)', async () => {
    const { processEvent } = await import('./dispatch.service.js');
    const eventId = await seedRoutedEvent({}); // no {{name}}

    await processEvent(WS, eventId);

    const { pool } = await import('../lib/db.js');
    const dl = await pool.query(`SELECT reason, last_error FROM dead_letters`);
    expect(dl.rows).toHaveLength(1);
    expect(dl.rows[0].reason).toBe('validation');
    expect(dl.rows[0].last_error).toMatch(/name/);
  });

  it('skips an opted-out subscriber', async () => {
    const { processEvent } = await import('./dispatch.service.js');
    const { subscribersRepository } = await import('../features/subscribers/subscribers.repository.js');
    const eventId = await seedRoutedEvent({ name: 'Ada' });

    const { pool } = await import('../lib/db.js');
    const sub = await pool.query<{ id: string }>(`SELECT id FROM subscribers LIMIT 1`);
    await subscribersRepository.setOptOut(sub.rows[0]!.id, 'email', true);

    await processEvent(WS, eventId);

    const attempts = await pool.query(`SELECT status FROM dispatch_attempts`);
    expect(attempts.rows[0]).toMatchObject({ status: 'skipped' });
  });
});

describe('template version immutability (DB trigger)', () => {
  it('rejects UPDATE on template_versions', async () => {
    const { templatesService } = await import('../features/templates/templates.service.js');
    const { pool } = await import('../lib/db.js');

    const tpl = await templatesService.create(WS, {
      name: 'T',
      event_type: 'e',
      channel: 'email',
    });
    if (!tpl.success) throw new Error('tpl');
    await templatesService.publishVersion(WS, tpl.data.id, { body_text: 'x' });

    await expect(
      pool.query(`UPDATE template_versions SET body_text = 'changed'`),
    ).rejects.toThrow(/append-only/);
  });
});

describe('idempotent ingestion (real Postgres)', () => {
  it('same idempotency key yields one event and one outbox row', async () => {
    const { eventsRepository } = await import('../features/events/events.repository.js');
    const { pool } = await import('../lib/db.js');

    const a = await eventsRepository.ingest({
      workspaceId: WS,
      eventType: 'x',
      payload: {},
      targetKind: 'subscriber',
      targetRef: 'u1',
      idempotencyKey: 'key-1',
    });
    const b = await eventsRepository.ingest({
      workspaceId: WS,
      eventType: 'x',
      payload: {},
      targetKind: 'subscriber',
      targetRef: 'u1',
      idempotencyKey: 'key-1',
    });

    expect(b.event.id).toBe(a.event.id);
    expect(b.created).toBe(false);

    const events = await pool.query(`SELECT count(*)::int AS n FROM events`);
    const outbox = await pool.query(`SELECT count(*)::int AS n FROM outbox`);
    expect(events.rows[0].n).toBe(1);
    expect(outbox.rows[0].n).toBe(1);
  });
});
