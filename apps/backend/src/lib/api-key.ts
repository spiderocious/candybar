import { createHash, randomBytes } from 'node:crypto';

/**
 * API key format: `cmq_<24 url-safe bytes>`. Only the SHA-256 hash is stored;
 * the plaintext is shown to the caller exactly once. `prefix` is the first 12
 * chars, safe to display for identification.
 */
export interface GeneratedKey {
  key: string;
  keyHash: string;
  prefix: string;
}

export function generateApiKey(): GeneratedKey {
  const key = `cmq_${randomBytes(24).toString('base64url')}`;
  return {
    key,
    keyHash: createHash('sha256').update(key).digest('hex'),
    prefix: key.slice(0, 12),
  };
}
