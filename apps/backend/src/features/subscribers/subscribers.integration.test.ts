import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// env.ts validates these at import; set before anything imports it.
process.env.DATABASE_URL ??= 'postgres://placeholder:placeholder@localhost:5999/placeholder';
process.env.REDIS_URL ??= 'redis://localhost:6999';
process.env.PROVIDER_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');

import { startStack, stopStack, truncateAll, type TestStack } from '../../test/containers.js';

let stack: TestStack;
const WS = 'ws_test_0001';

beforeAll(async () => {
  stack = await startStack();
  const { pool } = await import('../../lib/db.js');
  await pool.query(`INSERT INTO workspaces (id, name, slug) VALUES ($1, 'Test', 'test')`, [WS]);
});

afterAll(async () => {
  const { closePool } = await import('../../lib/db.js');
  await closePool();
  await stopStack(stack);
});

beforeEach(async () => {
  await truncateAll();
  const { pool } = await import('../../lib/db.js');
  await pool.query(`INSERT INTO workspaces (id, name, slug) VALUES ($1, 'Test', 'test')`, [WS]);
});

describe('subscriber dedup + soft-delete (real Postgres)', () => {
  it('registering the same external_id twice yields one row and merges attributes', async () => {
    const { subscribersService } = await import('./subscribers.service.js');
    const { subscribersRepository } = await import('./subscribers.repository.js');

    const first = await subscribersService.register(WS, {
      external_id: 'user-1',
      attributes: { a: 1 },
    });
    const second = await subscribersService.register(WS, {
      external_id: 'user-1',
      attributes: { b: 2 },
    });

    expect(first.success && second.success).toBe(true);
    if (first.success && second.success) {
      expect(second.data.id).toBe(first.data.id);
      expect(second.data.attributes).toEqual({ a: 1, b: 2 });
    }

    const page = await subscribersRepository.list(WS, { limit: 50 });
    expect(page.items).toHaveLength(1);
  });

  it('soft-deleted subscribers disappear from listings but the row survives', async () => {
    const { subscribersService } = await import('./subscribers.service.js');
    const { subscribersRepository } = await import('./subscribers.repository.js');
    const { pool } = await import('../../lib/db.js');

    const reg = await subscribersService.register(WS, { external_id: 'user-x' });
    if (!reg.success) throw new Error('register failed');

    await subscribersService.remove(WS, reg.data.id);

    const page = await subscribersRepository.list(WS, { limit: 50 });
    expect(page.items).toHaveLength(0);

    const raw = await pool.query(`SELECT is_deleted FROM subscribers WHERE id = $1`, [reg.data.id]);
    expect(raw.rows[0]).toMatchObject({ is_deleted: true });
  });

  it('opt-out is recorded per channel', async () => {
    const { subscribersService } = await import('./subscribers.service.js');
    const reg = await subscribersService.register(WS, { external_id: 'user-o' });
    if (!reg.success) throw new Error('register failed');

    const res = await subscribersService.setOptOut(WS, reg.data.id, {
      channel: 'email',
      opted_out: true,
    });
    expect(res.success && res.data.optouts).toContain('email');
  });
});
