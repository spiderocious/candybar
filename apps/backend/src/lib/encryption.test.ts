import { randomBytes } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  // env.ts validates PROVIDER_ENCRYPTION_KEY at import; set a valid 32-byte key.
  process.env.PROVIDER_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://x:x@localhost:5433/x';
  process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';
});

describe('encryption', () => {
  it('round-trips a config object', async () => {
    const { encryptJson, decryptJson } = await import('./encryption.js');
    const original = { api_key: 'secret-123', from_email: 'a@b.com' };
    const enc = encryptJson(original);
    expect(enc).not.toContain('secret-123');
    expect(decryptJson(enc)).toEqual(original);
  });

  it('masks all but the last 4 characters', async () => {
    const { maskConfig } = await import('./encryption.js');
    const masked = maskConfig({ api_key: 'abcdefgh' });
    expect(masked.api_key).toMatch(/\*+efgh$/);
  });
});
