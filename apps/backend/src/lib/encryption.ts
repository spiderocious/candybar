import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '../env.js';

/**
 * AES-256-GCM encryption for provider credentials at rest.
 * Stored format (base64url): iv(12) || authTag(16) || ciphertext.
 * The key is the base64-decoded PROVIDER_ENCRYPTION_KEY (must be 32 bytes).
 */
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const key = Buffer.from(env.PROVIDER_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `PROVIDER_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Generate with: openssl rand -base64 32`,
    );
  }
  return key;
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

export function decryptJson<T>(encoded: string): T {
  const buf = Buffer.from(encoded, 'base64url');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}

/** Mask a config object for safe display: keep last 4 chars of each string value. */
export function maskConfig(config: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    const s = String(v);
    out[k] = s.length <= 4 ? '****' : `${'*'.repeat(Math.max(s.length - 4, 4))}${s.slice(-4)}`;
  }
  return out;
}
